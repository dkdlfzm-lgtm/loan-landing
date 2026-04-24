#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse, csv, json, os, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
import requests

OFFICIAL_CITIES = [
    "서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시",
    "세종특별자치시","경기도","강원특별자치도","충청북도","충청남도","전북특별자치도",
    "전라남도","경상북도","경상남도","제주특별자치도",
]

DONE_RE = re.compile(r"\[done\]\s+inserted=(\d+)\s+skipped_duplicates=(\d+)\s+errors=(\d+)")
DOWNLOADED_RE = re.compile(r"\[downloaded\]\s+(.+)")
ADMIN_RE = re.compile(r"(구|군|시|읍|면|동)$")
BAD_DISTRICTS = {"신규", "갱신", "조회", "검색", "선택", "전체", "매매", "전세", "월세"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def month_range(start: str, end: str):
    sy, sm = int(start[:4]), int(start[4:6])
    ey, em = int(end[:4]), int(end[4:6])
    months = []
    y, m = sy, sm
    while (y < ey) or (y == ey and m <= em):
        months.append(f"{y}{m:02d}")
        m += 1
        if m > 12:
            y += 1
            m = 1
    return months


def ensure_playwright():
    try:
        from playwright.sync_api import sync_playwright  # noqa
    except Exception:
        raise RuntimeError("playwright 가 설치되지 않았습니다. pip install playwright && playwright install chromium 을 먼저 실행하세요.")


def _visible_text(s: str) -> str:
    return (s or "").strip()


def _option_texts(sel, limit=500):
    texts = []
    for opt in sel.locator("option").all()[:limit]:
        try:
            texts.append(_visible_text(opt.inner_text()))
        except Exception:
            continue
    return texts


def _is_admin_label(s: str) -> bool:
    s = _visible_text(s)
    if not s or s in BAD_DISTRICTS:
        return False
    if s in OFFICIAL_CITIES:
        return False
    return bool(ADMIN_RE.search(s))


def _select_by_label(sel, label: str):
    try:
        sel.select_option(label=label)
        return True
    except Exception:
        pass
    try:
        for opt in sel.locator("option").all()[:500]:
            txt = _visible_text(opt.inner_text())
            if txt == label:
                val = (opt.get_attribute("value") or "").strip()
                if val:
                    sel.select_option(value=val)
                    return True
        return False
    except Exception:
        return False


class SupabaseJobReporter:
    def __init__(self, job_id: str = ""):
        self.job_id = (job_id or os.environ.get("MOLIT_IMPORT_JOB_ID") or "").strip()
        self.url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip().rstrip("/")
        self.key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        self.enabled = bool(self.job_id and self.url and self.key)
        if self.job_id and not self.enabled:
            print("[warn] job_id는 있지만 Supabase 환경변수가 없어 진행률 DB 업데이트를 건너뜁니다.")

    def _headers(self, prefer="return=minimal"):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        }

    def patch_job(self, **body):
        if not self.enabled:
            return
        body.setdefault("updated_at", now_iso())
        endpoint = f"{self.url}/rest/v1/molit_import_jobs?id=eq.{self.job_id}"
        r = requests.patch(endpoint, headers=self._headers(), data=json.dumps(body, ensure_ascii=False), timeout=60)
        if not (200 <= r.status_code < 300):
            print(f"[warn] progress patch failed: {r.status_code} {r.text[:500]}")

    def insert_region(self, row: Dict[str, Any]):
        if not self.enabled:
            return
        row["job_id"] = self.job_id
        endpoint = f"{self.url}/rest/v1/molit_import_job_regions"
        r = requests.post(endpoint, headers=self._headers(), data=json.dumps([row], ensure_ascii=False), timeout=60)
        if not (200 <= r.status_code < 300):
            print(f"[warn] region insert failed: {r.status_code} {r.text[:500]}")

    def refresh_options(self) -> Optional[dict]:
        if not self.enabled:
            return None
        endpoint = f"{self.url}/rest/v1/rpc/refresh_property_catalog_options"
        r = requests.post(endpoint, headers=self._headers(prefer="return=representation"), data=json.dumps({}, ensure_ascii=False), timeout=180)
        if not (200 <= r.status_code < 300):
            print(f"[warn] option refresh failed: {r.status_code} {r.text[:500]}")
            return {"ok": False, "message": r.text[:500]}
        try:
            return r.json()
        except Exception:
            return {"ok": True, "raw": r.text[:500]}


def scrape_city_district_pairs(headful: bool = False, timeout_ms: int = 120000, debug: bool = True):
    ensure_playwright()
    from playwright.sync_api import sync_playwright

    pairs = []
    seen_pairs = set()
    debug_rows = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headful)
        context = browser.new_context(locale="ko-KR")
        page = context.new_page()
        page.set_default_timeout(timeout_ms)
        page.goto("https://rt.molit.go.kr/pt/xls/xls.do?mobileAt=", wait_until="domcontentloaded")

        try:
            page.get_by_role("heading", name="조건별 자료제공", exact=True).wait_for()
        except Exception:
            page.locator("h2.quarter-title").first.wait_for()

        selects = page.locator("select")
        total = selects.count()
        if total < 2:
            browser.close()
            raise RuntimeError("select 를 충분히 찾지 못했습니다.")

        city_sel = None
        for i in range(total):
            sel = selects.nth(i)
            options = _option_texts(sel, 150)
            matches = sum(1 for c in OFFICIAL_CITIES if c in options)
            if matches >= 8:
                city_sel = sel
                break
        if city_sel is None:
            browser.close()
            raise RuntimeError("시도 select 를 식별하지 못했습니다.")

        city_options = _option_texts(city_sel, 100)
        city_list = [c for c in OFFICIAL_CITIES if c in city_options]
        if debug:
            print(f"[debug] detected_cities={len(city_list)} {city_list}")

        for city in city_list:
            if not _select_by_label(city_sel, city):
                print(f"[warn] city select 실패: {city}")
                continue
            page.wait_for_timeout(1200)

            best_sel = None
            best_score = -1
            best_opts = []
            selects = page.locator("select")
            total2 = selects.count()
            for i in range(total2):
                sel = selects.nth(i)
                try:
                    opts = _option_texts(sel, 600)
                except Exception:
                    continue
                useful = [o for o in opts if o and o not in ("선택", "전체", city)]
                if not useful:
                    continue
                admin_count = sum(1 for o in useful if _is_admin_label(o))
                if admin_count == 0:
                    continue
                bad_count = sum(1 for o in useful if o in BAD_DISTRICTS)
                unique_count = len(dict.fromkeys(useful))
                score = admin_count * 100 + unique_count - bad_count * 50
                if score > best_score:
                    best_score = score
                    best_sel = sel
                    best_opts = useful

            if best_sel is None:
                print(f"[warn] district select 후보 없음: city={city}")
                continue

            districts = [d for d in best_opts if _is_admin_label(d)]
            uniq = []
            seen = set()
            for d in districts:
                if d not in seen:
                    seen.add(d)
                    uniq.append(d)
            districts = uniq

            debug_rows.append((city, len(districts), districts[:12]))
            if debug:
                print(f"[debug] city={city} districts={len(districts)} sample={districts[:12]}")

            for district in districts:
                key = (city, district)
                if key not in seen_pairs:
                    seen_pairs.add(key)
                    pairs.append(key)

        browser.close()

    if debug:
        print(f"[debug] total_pairs={len(pairs)}")
        for city, count, sample in debug_rows:
            print(f"[debug-city] {city}: {count} -> {sample}")
    return pairs


def build_jobs(city_arg: str, district_arg: str, start_month: str, end_month: str, headful: bool, debug: bool):
    months = month_range(start_month, end_month)
    if city_arg.upper() == "ALL":
        pairs = scrape_city_district_pairs(headful=headful, debug=debug)
    elif district_arg.upper() == "ALL":
        pairs = [pair for pair in scrape_city_district_pairs(headful=headful, debug=debug) if pair[0] == city_arg]
    else:
        pairs = [(city_arg, district_arg)]
    jobs = [(city, district, month) for month in months for city, district in pairs]
    if debug:
        print(f"[debug] jobs_preview={jobs[:20]}")
    return jobs


def run_job(base_dir: Path, city: str, district: str, month: str, headful: bool, master_path: str):
    script = base_dir / "bulk_download_and_import.py"
    cmd = [
        sys.executable, str(script),
        f"--city={city}",
        f"--district={district}",
        f"--start-month={month}",
        f"--end-month={month}",
        f"--master={master_path}",
    ]
    if headful:
        cmd.append("--headful")
    proc = subprocess.run(cmd, cwd=str(base_dir), capture_output=True, text=True, encoding="utf-8", errors="replace")

    inserted = skipped = errors = 0
    downloaded = ""
    for line in (proc.stdout or "").splitlines():
        m = DONE_RE.search(line)
        if m:
            inserted = int(m.group(1))
            skipped = int(m.group(2))
            errors = int(m.group(3))
        d = DOWNLOADED_RE.search(line)
        if d:
            downloaded = d.group(1).strip()

    ok = proc.returncode == 0 and errors == 0
    return {
        "ok": ok,
        "returncode": proc.returncode,
        "city": city,
        "district": district,
        "month": month,
        "inserted": inserted,
        "skipped": skipped,
        "errors": errors,
        "downloaded": downloaded,
        "stdout": proc.stdout or "",
        "stderr": proc.stderr or "",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    ap.add_argument("--district", required=True)
    ap.add_argument("--start-month", required=True)
    ap.add_argument("--end-month", required=True)
    ap.add_argument("--master", default="property-master.json")
    ap.add_argument("--job-id", default=os.environ.get("MOLIT_IMPORT_JOB_ID", ""))
    ap.add_argument("--headful", action="store_true")
    ap.add_argument("--debug", action="store_true", default=True)
    ap.add_argument("--refresh-options", action="store_true")
    args = ap.parse_args()

    base_dir = Path(__file__).resolve().parent
    logs_dir = base_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    reporter = SupabaseJobReporter(args.job_id)
    reporter.patch_job(
        status="planning",
        started_at=now_iso(),
        current_label="지역 목록을 확인하는 중",
        summary={"city": args.city, "district": args.district, "start_month": args.start_month, "end_month": args.end_month},
    )

    success = failed = total_inserted = total_skipped = total_errors = 0

    try:
        jobs = build_jobs(args.city, args.district, args.start_month, args.end_month, args.headful, args.debug)
        total_jobs = len(jobs)
        print(f"[plan] jobs={total_jobs}")
        reporter.patch_job(status="running", total_jobs=total_jobs, processed_jobs=0, progress_pct=0, current_label="적재 시작")

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        summary_csv = logs_dir / f"summary_nationwide_{ts}.csv"
        summary_txt = logs_dir / f"summary_nationwide_{ts}.txt"

        with summary_csv.open("w", encoding="utf-8-sig", newline="") as fcsv:
            writer = csv.writer(fcsv)
            writer.writerow(["no", "month", "city", "district", "ok", "result_label", "inserted", "skipped", "errors", "downloaded", "log_file"])

            for i, (city, district, month) in enumerate(jobs, start=1):
                label = f"{month} {city} {district}"
                print(f"\n[{i}/{total_jobs}] {label}")
                reporter.patch_job(current_label=label, processed_jobs=i - 1, progress_pct=round(((i - 1) / max(total_jobs, 1)) * 100, 1))

                result = run_job(base_dir, city, district, month, args.headful, args.master)

                safe_city = re.sub(r'[\\/:*?"<>|]', '_', city)
                safe_dist = re.sub(r'[\\/:*?"<>|]', '_', district)
                log_path = logs_dir / f"{i:04d}_{month}_{safe_city}_{safe_dist}.log"
                log_path.write_text(
                    f"=== STDOUT ===\n{result['stdout']}\n\n=== STDERR ===\n{result['stderr']}\n",
                    encoding="utf-8",
                )

                if result["ok"]:
                    success += 1
                else:
                    failed += 1
                total_inserted += result["inserted"]
                total_skipped += result["skipped"]
                total_errors += result["errors"]
                if not result["ok"] and result["errors"] == 0:
                    total_errors += 1

                result_label = "updated" if result["ok"] and result["inserted"] > 0 else "kept" if result["ok"] else "failed"
                message = "최신 업데이트" if result_label == "updated" else "기존 유지" if result_label == "kept" else (result["stderr"] or result["stdout"])[-500:]

                writer.writerow([
                    i, month, city, district, "Y" if result["ok"] else "N", result_label,
                    result["inserted"], result["skipped"], result["errors"], result["downloaded"], str(log_path),
                ])

                reporter.insert_region({
                    "no": i,
                    "month": month,
                    "city": city,
                    "district": district,
                    "status": "SUCCESS" if result["ok"] else "FAILED",
                    "result_label": result_label,
                    "inserted_rows": result["inserted"],
                    "skipped_rows": result["skipped"],
                    "error_count": result["errors"] if result["errors"] else (0 if result["ok"] else 1),
                    "downloaded_file": result["downloaded"],
                    "message": message[:1000] if message else "",
                })

                reporter.patch_job(
                    status="running",
                    processed_jobs=i,
                    success_jobs=success,
                    failed_jobs=failed,
                    inserted_rows=total_inserted,
                    skipped_rows=total_skipped,
                    error_count=total_errors,
                    progress_pct=round((i / max(total_jobs, 1)) * 100, 1),
                    current_label=label,
                    last_error="" if result["ok"] else message[:1000],
                )

                print(
                    f"[result] ok={result['ok']} inserted={result['inserted']} "
                    f"skipped={result['skipped']} errors={result['errors']} downloaded={bool(result['downloaded'])}"
                )

        refresh_result = None
        if args.refresh_options:
            reporter.patch_job(current_label="시세조회 드롭다운 옵션 테이블 갱신 중")
            refresh_result = reporter.refresh_options()
            reporter.patch_job(options_refreshed_at=now_iso(), summary={
                "city": args.city,
                "district": args.district,
                "start_month": args.start_month,
                "end_month": args.end_month,
                "summary_csv": str(summary_csv),
                "refresh_options": refresh_result,
            })

        final_status = "completed" if failed == 0 and total_errors == 0 else "completed_with_errors"
        reporter.patch_job(
            status=final_status,
            finished_at=now_iso(),
            progress_pct=100,
            current_label="완료" if final_status == "completed" else "일부 오류 완료",
            total_jobs=total_jobs,
            processed_jobs=total_jobs,
            success_jobs=success,
            failed_jobs=failed,
            inserted_rows=total_inserted,
            skipped_rows=total_skipped,
            error_count=total_errors,
        )

        summary_txt.write_text(
            "\n".join([
                "[finished]",
                f"summary_txt={summary_txt}",
                f"summary_csv={summary_csv}",
                f"success_jobs={success} failed_jobs={failed} inserted={total_inserted} skipped={total_skipped} errors={total_errors}",
            ]),
            encoding="utf-8",
        )

        print("\n[finished]")
        print(f"summary_txt={summary_txt}")
        print(f"summary_csv={summary_csv}")
        print(f"success_jobs={success} failed_jobs={failed} inserted={total_inserted} skipped={total_skipped} errors={total_errors}")

    except Exception as e:
        reporter.patch_job(status="failed", finished_at=now_iso(), current_label="실패", last_error=str(e)[:1000])
        raise


if __name__ == "__main__":
    main()
