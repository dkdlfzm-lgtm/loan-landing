
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse, csv, json, os, re, sys, unicodedata
from collections import OrderedDict, defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import requests

def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", str(s or "")).strip()

def digits_only(s: str) -> str:
    return re.sub(r"\D+", "", str(s or ""))

def normalize_name(s: str) -> str:
    s = nfc(s)
    s = re.sub(r"\s+", "", s)
    return s.lower()

def amount_manwon_to_won(v: str) -> Optional[int]:
    s = re.sub(r"[^\d]", "", str(v or ""))
    return int(s) * 10_000 if s else None

def parse_area(v: str) -> Optional[float]:
    s = re.sub(r"[^\d.]", "", str(v or ""))
    try:
        return float(s) if s else None
    except Exception:
        return None

def parse_deal_date(ym: str, day: str) -> Optional[str]:
    ym = digits_only(ym)
    day = digits_only(day).zfill(2) if digits_only(day) else "01"
    if len(ym) != 6:
        return None
    try:
        return datetime.strptime(ym + day, "%Y%m%d").date().isoformat()
    except Exception:
        return None

def calc_price_per_m2(amount_won: Optional[int], area_m2: Optional[float]) -> Optional[int]:
    if not amount_won or not area_m2 or area_m2 <= 0:
        return None
    return int(round(amount_won / area_m2))

def month_range(start_ym: str, end_ym: str) -> List[str]:
    sy, sm = int(start_ym[:4]), int(start_ym[4:])
    ey, em = int(end_ym[:4]), int(end_ym[4:])
    out = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        out.append(f"{y:04d}{m:02d}")
        m += 1
        if m > 12:
            y += 1
            m = 1
    return out

def ym_to_dates(ym: str) -> Tuple[str, str]:
    y, m = int(ym[:4]), int(ym[4:])
    start = date(y, m, 1)
    if m == 12:
        end = date(y + 1, 1, 1)
    else:
        end = date(y, m + 1, 1)
    last = end.fromordinal(end.toordinal() - 1)
    return start.isoformat(), last.isoformat()

HEADER_CANDIDATES = {
    "address": ["시군구"],
    "bunji": ["번지"],
    "bonbun": ["본번"],
    "bubun": ["부번"],
    "apartment_name": ["단지명", "단지 명"],
    "area": ["전용면적(㎡)", "전용면적"],
    "deal_ym": ["계약년월"],
    "deal_day": ["계약일"],
    "price_manwon": ["거래금액(만원)", "거래금액"],
    "dong": ["동"],
    "floor": ["층"],
    "built_year": ["건축년도"],
    "road_name": ["도로명"],
    "cancel_date": ["해제사유발생일"],
    "trade_type": ["거래유형"],
    "broker_location": ["중개사소재지"],
    "registry_date": ["등기일자"],
}

def find_header_row(rows: List[List[str]]) -> int:
    key_sets = [
        {"시군구", "단지명", "전용면적(㎡)", "계약년월", "계약일", "거래금액(만원)"},
        {"시군구", "단지명", "전용면적", "계약년월", "계약일", "거래금액"},
    ]
    for i, row in enumerate(rows[:60]):
        s = {nfc(x) for x in row if nfc(x)}
        if any(keys.issubset(s) for keys in key_sets):
            return i
    return -1

def map_headers(header: List[str]) -> Dict[str, str]:
    result = {}
    norm_map = {normalize_name(h): h for h in header}
    for key, cands in HEADER_CANDIDATES.items():
        for cand in cands:
            actual = norm_map.get(normalize_name(cand))
            if actual:
                result[key] = actual
                break
    return result

def parse_csv_with_header_detection(csv_path: Path) -> Tuple[List[dict], dict]:
    encodings = ["utf-8-sig", "cp949", "euc-kr", "utf-8"]
    last_err = None
    for enc in encodings:
        try:
            text = csv_path.read_text(encoding=enc)
            sample = text[:4096]
            try:
                delimiter = csv.Sniffer().sniff(sample).delimiter
            except Exception:
                delimiter = ","
            rows = list(csv.reader(text.splitlines(), delimiter=delimiter))
            header_idx = find_header_row(rows)
            if header_idx < 0:
                return [], {"encoding": enc, "delimiter": delimiter, "rows": max(0, len(rows)-1), "header_row_index": -1, "header": [], "mapped_headers": {}}
            header = [nfc(x) for x in rows[header_idx]]
            mapped = map_headers(header)
            dict_rows = []
            for row in rows[header_idx+1:]:
                if not any(nfc(x) for x in row):
                    continue
                padded = row + [""] * (len(header) - len(row))
                dict_rows.append({header[i]: padded[i] for i in range(len(header))})
            return dict_rows, {"encoding": enc, "delimiter": delimiter, "rows": len(dict_rows), "header_row_index": header_idx, "header": header, "mapped_headers": mapped}
        except Exception as e:
            last_err = e
    raise RuntimeError(f"CSV 파싱 실패: {last_err}")

def split_address(address: str) -> Tuple[str, str, str]:
    parts = [p for p in nfc(address).split() if p]
    return (
        parts[0] if len(parts) >= 1 else "",
        parts[1] if len(parts) >= 2 else "",
        parts[2] if len(parts) >= 3 else "",
    )

def load_property_master(master_path: Path) -> dict:
    return json.loads(master_path.read_text(encoding="utf-8"))

def build_region_index(master: dict):
    apt_map = master.get("아파트", {})
    region_index = defaultdict(list)
    lawd_lookup = {}
    cities = []
    for city, rows in apt_map.items():
        cities.append(city)
        for r in rows:
            district = nfc(r.get("district"))
            town = nfc(r.get("town"))
            apt = normalize_name(r.get("apartment"))
            bjd = digits_only(r.get("bjdCode"))
            lawd = bjd[:5] if len(bjd) >= 5 else ""
            if city and district:
                region_index[(city, district)].append(r)
            if city and district and town and apt and lawd:
                lawd_lookup[(city, district, town, apt)] = lawd
    return sorted(set(cities)), region_index, lawd_lookup

def infer_city_for_district(region_index, district: str) -> Optional[str]:
    cities = sorted({city for city, dist in region_index.keys() if dist == district})
    return cities[0] if len(cities) == 1 else None

def normalize_rows(csv_rows: List[dict], meta: dict, lawd_lookup: Dict[Tuple[str, str, str, str], str]) -> List[dict]:
    mh = meta["mapped_headers"]
    out = []
    for r in csv_rows:
        def get(field):
            h = mh.get(field)
            return r.get(h, "") if h else ""
        address = get("address")
        city, district, town = split_address(address)
        apt = nfc(get("apartment_name"))
        apt_norm = normalize_name(apt)
        if not city or not district or not apt:
            continue
        lawd = lawd_lookup.get((city, district, town, apt_norm), "")
        bunji = nfc(get("bunji"))
        bonbun = digits_only(get("bonbun"))
        bubun = digits_only(get("bubun"))
        jibun = bunji or ""
        if bonbun:
            jibun = bonbun
            if bubun and bubun != "0":
                jibun += f"-{int(bubun)}"
        area_m2 = parse_area(get("area"))
        deal_date = parse_deal_date(get("deal_ym"), get("deal_day"))
        amount_won = amount_manwon_to_won(get("price_manwon"))
        if not deal_date or not amount_won:
            continue
        out.append({
            "property_type": "apartment_trade",
            "city": city,
            "district": district,
            "town": town,
            "lawd_code": lawd,
            "apartment_name": apt,
            "apartment_name_norm": apt_norm,
            "jibun": jibun,
            "area_m2": area_m2,
            "deal_date": deal_date,
            "amount_won": amount_won,
            "price_per_m2": calc_price_per_m2(amount_won, area_m2),
            "source": "molit_csv",
            "collected_at": datetime.utcnow().isoformat() + "Z",
            "raw_payload": r,
        })
    seen = OrderedDict()
    for row in out:
        key = (
            row["property_type"], row["lawd_code"], row["apartment_name_norm"],
            row["jibun"] or "", str(row["area_m2"] or 0), row["deal_date"], row["amount_won"]
        )
        seen.setdefault(key, row)
    return list(seen.values())

def supabase_headers() -> dict:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.")
    return {
        "url": url.rstrip("/"),
        "headers": {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    }

def insert_rows(rows: List[dict], batch_size: int = 100) -> Tuple[int, int, int]:
    cfg = supabase_headers()
    endpoint = f"{cfg['url']}/rest/v1/apartment_trade_cache"
    inserted = skipped = errors = 0

    def is_dup_error(text: str) -> bool:
        t = text.lower()
        return "duplicate key" in t or "unique constraint" in t or '"code":"23505"' in t

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        resp = requests.post(endpoint, headers=cfg["headers"], data=json.dumps(batch), timeout=120)
        if 200 <= resp.status_code < 300:
            inserted += len(batch)
            print(f"[batch] inserted={len(batch)} total_inserted={inserted}")
            continue
        print(f"[warn] batch insert returned status={resp.status_code}")
        print(resp.text[:1000])
        for row in batch:
            r = requests.post(endpoint, headers=cfg["headers"], data=json.dumps([row]), timeout=120)
            if 200 <= r.status_code < 300:
                inserted += 1
            else:
                txt = r.text[:1000]
                if is_dup_error(txt):
                    skipped += 1
                else:
                    errors += 1
                    print(f"[row-error] status={r.status_code} body={txt}")
    return inserted, skipped, errors

def ensure_playwright():
    try:
        from playwright.sync_api import sync_playwright  # noqa
    except Exception:
        raise RuntimeError("playwright 가 설치되지 않았습니다. 먼저 'pip install playwright' 후 'playwright install chromium' 실행하세요.")

def select_option_flex(page, label_text: str, value_text: str) -> bool:
    selects = page.locator("select")
    for i in range(selects.count()):
        sel = selects.nth(i)
        try:
            option_labels = [o.inner_text().strip() for o in sel.locator("option").all()[:100]]
            joined = " ".join(option_labels)
            if value_text in joined or label_text in joined:
                sel.select_option(label=value_text)
                page.wait_for_timeout(1200)
                return True
        except Exception:
            continue
    return False

def run_download(city: str, district: str, ym: str, download_dir: Path, headless: bool = True, timeout_ms: int = 120000) -> Path:
    ensure_playwright()
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    start_date, end_date = ym_to_dates(ym)
    download_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(accept_downloads=True, locale="ko-KR")
        page = context.new_page()
        page.set_default_timeout(timeout_ms)
        page.goto("https://rt.molit.go.kr/pt/xls/xls.do?mobileAt=", wait_until="domcontentloaded")

        try:
            page.get_by_role("heading", name="조건별 자료제공", exact=True).wait_for()
        except Exception:
            page.locator("h2.quarter-title").first.wait_for()

        try:
            page.get_by_text("아파트", exact=True).click()
        except Exception:
            pass
        try:
            page.get_by_text("매매", exact=True).click()
        except Exception:
            pass

        text_like = []
        for loc in page.locator("input").all():
            try:
                t = (loc.get_attribute("type") or "").lower()
                readonly = loc.get_attribute("readonly")
                if t in ("text", "search", "date", "") and readonly is None:
                    text_like.append(loc)
            except Exception:
                continue
        if len(text_like) >= 2:
            text_like[0].fill(start_date)
            text_like[1].fill(end_date)
        else:
            browser.close()
            raise RuntimeError("계약일자 입력칸을 자동으로 찾지 못했습니다.")

        found_city = select_option_flex(page, "시도", city)
        found_district = select_option_flex(page, "시군구", district) if found_city else False
        if not found_city or not found_district:
            browser.close()
            raise RuntimeError(f"시도/시군구 선택 실패: city={city} district={district}")

        try:
            with page.expect_download(timeout=timeout_ms) as dl:
                page.get_by_text("CSV 다운", exact=False).click()
            download = dl.value
            suggested = download.suggested_filename
            safe_name = f"{ym}_{city}_{district}_{suggested}"
            save_path = download_dir / safe_name
            download.save_as(str(save_path))
        except PWTimeout:
            browser.close()
            raise RuntimeError("CSV 다운로드 대기 중 타임아웃이 발생했습니다.")
        finally:
            browser.close()

        if not save_path.exists():
            raise RuntimeError("CSV 파일 저장을 확인하지 못했습니다.")
        return save_path

@dataclass
class Job:
    city: str
    district: str
    ym: str

def load_env_cmd_if_present(base: Path):
    env_cmd = base / "env.cmd"
    if not env_cmd.exists():
        return
    text = env_cmd.read_text(encoding="utf-8", errors="ignore")
    for line in text.splitlines():
        line = line.strip()
        if not line.lower().startswith("set "):
            continue
        m = re.match(r'set\s+"?([^=]+)=([^"]*)"?$', line, re.I)
        if m:
            os.environ.setdefault(m.group(1).strip(), m.group(2))

def build_jobs(master: dict, city_arg: Optional[str], district_arg: Optional[str], start_month: str, end_month: str):
    cities, region_index, lawd_lookup = build_region_index(master)
    months = month_range(start_month, end_month)
    jobs = []
    if city_arg and city_arg.upper() == "ALL":
        selected_pairs = sorted(region_index.keys())
    elif city_arg and district_arg and district_arg.upper() == "ALL":
        selected_pairs = sorted([pair for pair in region_index.keys() if pair[0] == city_arg])
    elif city_arg and district_arg:
        selected_pairs = [(city_arg, district_arg)]
    elif district_arg:
        inferred = infer_city_for_district(region_index, district_arg)
        if not inferred:
            raise RuntimeError(f"district={district_arg} 에 대응하는 city를 자동 판별하지 못했습니다. --city도 함께 지정하세요.")
        selected_pairs = [(inferred, district_arg)]
    else:
        selected_pairs = sorted(region_index.keys())

    for ym in months:
        for city, district in selected_pairs:
            jobs.append(Job(city=city, district=district, ym=ym))
    return jobs, lawd_lookup

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download-only", action="store_true")
    ap.add_argument("--import-only", action="store_true")
    ap.add_argument("--downloads-dir", default="downloads")
    ap.add_argument("--start-month", help="예: 202603")
    ap.add_argument("--end-month", help="예: 202604")
    ap.add_argument("--city", help="예: 서울특별시 또는 ALL")
    ap.add_argument("--district", help="예: 강남구 또는 ALL")
    ap.add_argument("--headful", action="store_true")
    ap.add_argument("--master", default="property-master.json")
    args = ap.parse_args()

    base = Path.cwd()
    load_env_cmd_if_present(base)
    downloads_dir = (base / args.downloads_dir).resolve()
    master = load_property_master((base / args.master).resolve())

    if args.start_month and args.end_month:
        start_month, end_month = args.start_month, args.end_month
    elif args.start_month:
        start_month = end_month = args.start_month
    else:
        today = date.today()
        prev_month = today.month - 1 or 12
        prev_year = today.year if today.month > 1 else today.year - 1
        start_month = end_month = f"{prev_year:04d}{prev_month:02d}"

    jobs, lawd_lookup = build_jobs(master, args.city, args.district, start_month, end_month)
    print(f"[plan] jobs={len(jobs)} months={month_range(start_month, end_month)} scope_city={args.city or '(auto)'} scope_district={args.district or '(auto)'}")

    total_inserted = total_skipped = total_errors = 0
    for job in jobs:
        print(f"\n=== {job.ym} {job.city} {job.district} ===")
        csv_path = None
        if not args.import_only:
            try:
                csv_path = run_download(job.city, job.district, job.ym, downloads_dir, headless=not args.headful)
                print(f"[downloaded] {csv_path}")
            except Exception as e:
                print(f"[download-error] {e}")
                total_errors += 1
                continue
        else:
            candidates = sorted(downloads_dir.glob(f"{job.ym}_{job.city}_{job.district}_*.csv"))
            if not candidates:
                print("[skip] import-only 모드인데 대상 CSV가 없습니다.")
                continue
            csv_path = candidates[-1]

        if not args.download_only and csv_path:
            rows, meta = parse_csv_with_header_detection(csv_path)
            print(f"[info] encoding={meta['encoding']} delimiter={meta['delimiter']} rows={meta['rows']} header_row_index={meta['header_row_index']}")
            print(f"[info] header={meta['header']}")
            print(f"[info] mapped_headers={meta['mapped_headers']}")
            normalized = normalize_rows(rows, meta, lawd_lookup)
            print(f"[info] normalized={len(normalized)}")
            if not normalized:
                print("[skip] 정규화된 데이터가 없습니다.")
                continue
            try:
                inserted, skipped, errors = insert_rows(normalized)
                total_inserted += inserted
                total_skipped += skipped
                total_errors += errors
                print(f"[done] inserted={inserted} skipped_duplicates={skipped} errors={errors}")
            except Exception as e:
                total_errors += 1
                print(f"[import-error] {e}")
    print(f"\n[summary] inserted={total_inserted} skipped_duplicates={total_skipped} errors={total_errors}")

if __name__ == "__main__":
    main()
