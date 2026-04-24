"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReviewDateTime } from "../lib-reviews";

const CITY_OPTIONS = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

function previousMonthYYYYMM() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value, fallback = "미입력") {
  const v = String(value || "").replace(/\D/g, "").slice(0, 6);
  if (!/^\d{6}$/.test(v)) return fallback;
  const year = v.slice(0, 4);
  const month = Number(v.slice(4, 6));
  if (month < 1 || month > 12) return fallback;
  return `${year}년 ${month}월`;
}

function validMonth(value) {
  const v = String(value || "");
  if (!/^\d{6}$/.test(v)) return false;
  const month = Number(v.slice(4, 6));
  return month >= 1 && month <= 12;
}

function percentOf(job) {
  const raw = Number(job?.progress_pct || 0);
  if (Number.isFinite(raw)) return Math.max(0, Math.min(100, Math.round(raw)));
  const total = Number(job?.total_jobs || 0);
  const done = Number(job?.processed_jobs || 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function statusText(status) {
  const map = {
    queued: "대기중",
    planning: "작업 준비중",
    running: "적재 진행중",
    completed: "완료",
    completed_with_errors: "일부 오류 완료",
    failed: "실패",
    cancelled: "취소됨",
  };
  return map[status] || status || "대기";
}

function resultText(row) {
  if (row?.result_label === "updated") return "최신 업데이트";
  if (row?.result_label === "kept") return "기존 유지";
  if (row?.result_label === "failed") return "오류";
  if (row?.status === "SUCCESS" && Number(row?.inserted_rows || 0) > 0) return "최신 업데이트";
  if (row?.status === "SUCCESS") return "기존 유지";
  return row?.status || "-";
}

function SummaryCard({ title, value, subtitle, tone = "default" }) {
  return (
    <div className={`crm-summary-card crm-tone-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{subtitle}</small>
    </div>
  );
}

function HelpText({ children }) {
  return <p className="molit-help-text">{children}</p>;
}

function FieldBox({ label, badge, help, children }) {
  return (
    <label className="molit-field-box">
      <span className="molit-field-label">
        {label}
        {badge ? <em>{badge}</em> : null}
      </span>
      {children}
      {help ? <HelpText>{help}</HelpText> : null}
    </label>
  );
}

export default function MolitImportPanel() {
  const defaultMonth = useMemo(() => previousMonthYYYYMM(), []);
  const [tradeStats, setTradeStats] = useState({ summary: null, daily: [], monthly: [], fetched_at: null });
  const [jobs, setJobs] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState("nationwide");
  const [form, setForm] = useState({
    city: "ALL",
    district: "ALL",
    startMonth: defaultMonth,
    endMonth: defaultMonth,
  });

  const latestJob = jobs[0] || null;
  const progress = percentOf(latestJob);
  const running = ["queued", "planning", "running"].includes(latestJob?.status);
  const tradeSummary = tradeStats.summary || {
    total_rows: 0,
    today_rows: 0,
    monthly_rows: 0,
    latest_collected_at: null,
  };

  const monthRangeText = `${monthLabel(form.startMonth, "시작월 미입력")} ~ ${monthLabel(form.endMonth, "종료월 미입력")}`;
  const regionSummary = useMemo(() => {
    if (scope === "nationwide") return "전국 전체";
    if (scope === "city") return form.city && form.city !== "ALL" ? `${form.city} 전체` : "시/도 미선택";
    const city = form.city && form.city !== "ALL" ? form.city : "시/도 미선택";
    const district = form.district && form.district !== "ALL" ? form.district : "시/군/구 미입력";
    return `${city} ${district}`;
  }, [scope, form.city, form.district]);

  const formInvalidReason = useMemo(() => {
    if (!validMonth(form.startMonth)) return "조회 시작월을 YYYYMM 형식으로 입력하세요. 예: 202601";
    if (!validMonth(form.endMonth)) return "조회 종료월을 YYYYMM 형식으로 입력하세요. 예: 202603";
    if (Number(form.startMonth) > Number(form.endMonth)) return "조회 시작월은 조회 종료월보다 늦을 수 없습니다.";
    if (scope !== "nationwide" && (!form.city || form.city === "ALL")) return "특정 지역 업데이트는 시/도를 선택해야 합니다.";
    if (scope === "district" && (!form.district || form.district === "ALL")) return "특정 시/군/구 업데이트는 시/군/구명을 입력해야 합니다.";
    return "";
  }, [form.startMonth, form.endMonth, form.city, form.district, scope]);

  const canStart = !starting && !running && !formInvalidReason;

  function changeScope(nextScope) {
    setScope(nextScope);
    setError("");
    setMessage("");
    setForm((prev) => {
      if (nextScope === "nationwide") {
        return { ...prev, city: "ALL", district: "ALL" };
      }
      if (nextScope === "city") {
        return { ...prev, city: prev.city === "ALL" ? "" : prev.city, district: "ALL" };
      }
      return { ...prev, city: prev.city === "ALL" ? "" : prev.city, district: prev.district === "ALL" ? "" : prev.district };
    });
  }

  async function loadAll({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const [statsRes, jobsRes] = await Promise.all([
        fetch("/api/admin/trade-cache", { cache: "no-store" }),
        fetch("/api/admin/molit-import-jobs", { cache: "no-store" }),
      ]);
      const statsData = await statsRes.json();
      const jobsData = await jobsRes.json();

      if (statsRes.ok && statsData.ok) {
        setTradeStats({
          summary: statsData.summary || null,
          daily: statsData.daily || [],
          monthly: statsData.monthly || [],
          fetched_at: statsData.fetched_at || null,
        });
      }

      if (!jobsRes.ok || !jobsData.ok) {
        throw new Error(jobsData.message || "적재 작업 상태를 불러오지 못했습니다.");
      }

      setJobs(jobsData.jobs || []);
      setRegions(jobsData.regions || []);
      setError("");
    } catch (err) {
      if (!silent) setError(err?.message || "실거래 적재 현황을 불러오지 못했습니다.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function startImport() {
    setError("");
    setMessage("");

    if (formInvalidReason) {
      setError(formInvalidReason);
      return;
    }

    setStarting(true);
    try {
      const payload = {
        ...form,
        city: scope === "nationwide" ? "ALL" : form.city,
        district: scope === "district" ? form.district.trim() : "ALL",
      };

      const res = await fetch("/api/admin/molit-import-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "시세 데이터 업데이트 실행에 실패했습니다.");
      setMessage("시세 데이터 업데이트 작업을 시작했습니다. 진행률은 자동으로 갱신됩니다.");
      await loadAll({ silent: true });
    } catch (err) {
      setError(err?.message || "시세 데이터 업데이트 실행에 실패했습니다.");
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    loadAll().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadAll({ silent: true }).catch(() => null);
    }, running ? 4000 : 10000);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <div className="owner-performance-shell">
      <style jsx>{`
        .molit-intro-box {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          margin-bottom: 18px;
          padding: 18px;
          border: 1px solid rgba(37, 99, 235, 0.18);
          background: linear-gradient(135deg, rgba(37,99,235,.08), rgba(14,165,233,.05));
          border-radius: 20px;
        }
        .molit-intro-box strong {
          display: block;
          color: #0f172a;
          font-size: 16px;
          margin-bottom: 6px;
        }
        .molit-intro-box span {
          display: block;
          color: #475569;
          line-height: 1.55;
          font-size: 13px;
        }
        .molit-mini-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 86px;
          padding: 10px 12px;
          border-radius: 999px;
          background: #0f3f91;
          color: #fff;
          font-size: 13px;
          font-weight: 900;
          box-shadow: 0 12px 24px rgba(15, 63, 145, .18);
          white-space: nowrap;
        }
        .molit-setup-card {
          margin-top: 18px;
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, .32);
          background: #f8fafc;
          border-radius: 22px;
        }
        .molit-setup-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }
        .molit-setup-head strong {
          display: block;
          color: #0f172a;
          font-size: 16px;
          margin-bottom: 4px;
        }
        .molit-setup-head span {
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
        }
        .molit-mode-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .molit-mode-card {
          border: 1px solid rgba(148, 163, 184, .42);
          border-radius: 16px;
          background: #fff;
          padding: 13px 14px;
          text-align: left;
          cursor: pointer;
          color: #334155;
          transition: all .18s ease;
        }
        .molit-mode-card:hover {
          transform: translateY(-1px);
          border-color: rgba(37, 99, 235, .45);
          box-shadow: 0 12px 24px rgba(15, 23, 42, .06);
        }
        .molit-mode-card.is-active {
          border-color: rgba(37, 99, 235, .85);
          background: linear-gradient(135deg, #0f3f91, #2563eb);
          color: #fff;
          box-shadow: 0 16px 30px rgba(37, 99, 235, .22);
        }
        .molit-mode-card b {
          display: block;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .molit-mode-card small {
          display: block;
          font-size: 12px;
          line-height: 1.4;
          color: inherit;
          opacity: .82;
        }
        .molit-form-grid {
          display: grid;
          grid-template-columns: minmax(210px, 1.1fr) minmax(210px, 1.1fr) minmax(170px, .9fr) minmax(170px, .9fr);
          gap: 12px;
          align-items: stretch;
        }
        .molit-field-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }
        .molit-field-label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
        }
        .molit-field-label em {
          font-style: normal;
          color: #2563eb;
          background: rgba(37, 99, 235, .08);
          border-radius: 999px;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 900;
        }
        .molit-field-box input,
        .molit-field-box select {
          width: 100%;
          min-height: 48px;
          border: 1px solid rgba(148, 163, 184, .55);
          border-radius: 14px;
          padding: 0 14px;
          color: #0f172a;
          background: #fff;
          font-weight: 800;
          outline: none;
        }
        .molit-field-box input:disabled,
        .molit-field-box select:disabled {
          color: #94a3b8;
          background: #eef2f7;
          cursor: not-allowed;
        }
        .molit-field-box input:focus,
        .molit-field-box select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, .10);
        }
        .molit-help-text {
          min-height: 34px;
          margin: 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
          word-break: keep-all;
        }
        .molit-summary-strip {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          margin-top: 16px;
          padding: 15px 16px;
          border-radius: 18px;
          border: 1px solid rgba(37, 99, 235, .16);
          background: #fff;
        }
        .molit-summary-strip span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .molit-summary-strip strong {
          color: #0f172a;
          font-size: 15px;
          line-height: 1.45;
        }
        .molit-summary-strip button {
          min-height: 52px;
          border-radius: 15px;
          padding: 0 24px;
          white-space: nowrap;
        }
        .molit-invalid-note {
          margin-top: 10px;
          color: #dc2626;
          background: rgba(220, 38, 38, .07);
          border: 1px solid rgba(220, 38, 38, .18);
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 800;
        }
        .molit-progress-line {
          height: 12px;
          background: rgba(15,23,42,.10);
          border-radius: 999px;
          overflow: hidden;
        }
        .molit-progress-fill {
          height: 100%;
          background: linear-gradient(90deg,#2563eb,#22c55e);
          border-radius: 999px;
          transition: width .4s ease;
        }
        @media (max-width: 980px) {
          .molit-intro-box,
          .molit-summary-strip {
            grid-template-columns: 1fr;
          }
          .molit-mode-grid,
          .molit-form-grid {
            grid-template-columns: 1fr;
          }
          .molit-summary-strip button {
            width: 100%;
          }
        }
      `}</style>

      <section className="crm-panel crm-panel-xl">
        <div className="crm-section-header">
          <h3>시세조회 데이터 최신 업데이트</h3>
          <span>공공데이터 실거래가를 불러와 PC·모바일 시세조회 데이터를 최신 상태로 갱신합니다.</span>
        </div>

        <div className="molit-intro-box">
          <div>
            <strong>업데이트 전에 지역과 조회월을 먼저 선택하세요.</strong>
            <span>
              이미 저장된 실거래가는 기존 유지로 처리하고, 새로 확인된 데이터만 DB에 추가합니다.
              완료 후 빠른 드롭다운용 옵션 테이블도 자동 갱신됩니다.
            </span>
          </div>
          <div className="molit-mini-badge">PC·모바일 공통</div>
        </div>

        <div className="crm-summary-grid crm-summary-grid-pro" style={{ marginBottom: 20 }}>
          <SummaryCard title="누적 저장건" value={tradeSummary.total_rows || 0} subtitle="실거래 캐시 누적 건수" tone="new" />
          <SummaryCard title="오늘 적재건" value={tradeSummary.today_rows || 0} subtitle="오늘 저장된 실거래 건수" tone="contacted" />
          <SummaryCard title="이번달 적재건" value={tradeSummary.monthly_rows || 0} subtitle="이번달 저장된 건수" tone="closed" />
          <SummaryCard title="최근 적재 시각" value={tradeSummary.latest_collected_at ? formatReviewDateTime(tradeSummary.latest_collected_at) : "-"} subtitle="마지막 저장 기준" />
        </div>

        <div className="crm-assignment-banner">
          <div>
            <strong>실행 방식</strong>
            <span>관리자 버튼은 GitHub Actions 작업을 실행하고, 실제 수집은 Actions 서버에서 진행됩니다. 그래서 Vercel 시간 제한에 걸리지 않습니다.</span>
          </div>
          <div className="crm-assignment-banner-stats">
            <b>{progress}%</b>
            <small>{statusText(latestJob?.status)}</small>
          </div>
        </div>

        <div className="molit-setup-card">
          <div className="molit-setup-head">
            <div>
              <strong>업데이트 조건 설정</strong>
              <span>전국 전체, 특정 시/도, 특정 시/군/구 중 하나를 고르고 조회할 월 범위를 입력하세요.</span>
            </div>
          </div>

          <div className="molit-mode-grid" role="group" aria-label="업데이트 지역 범위">
            <button
              type="button"
              className={`molit-mode-card ${scope === "nationwide" ? "is-active" : ""}`}
              onClick={() => changeScope("nationwide")}
            >
              <b>전국 전체</b>
              <small>모든 시/도와 시/군/구를 한 번에 업데이트합니다.</small>
            </button>
            <button
              type="button"
              className={`molit-mode-card ${scope === "city" ? "is-active" : ""}`}
              onClick={() => changeScope("city")}
            >
              <b>특정 시/도</b>
              <small>서울특별시, 경기도처럼 선택한 시/도 전체만 업데이트합니다.</small>
            </button>
            <button
              type="button"
              className={`molit-mode-card ${scope === "district" ? "is-active" : ""}`}
              onClick={() => changeScope("district")}
            >
              <b>특정 시/군/구</b>
              <small>강남구, 수원시, 해운대구처럼 세부 지역만 업데이트합니다.</small>
            </button>
          </div>

          <div className="molit-form-grid">
            <FieldBox
              label="시/도 선택"
              badge={scope === "nationwide" ? "자동 전체" : "필수"}
              help={scope === "nationwide" ? "전국 전체 선택 시 시/도는 자동으로 전체 처리됩니다." : "예: 서울특별시, 경기도, 부산광역시"}
            >
              <select
                value={scope === "nationwide" ? "ALL" : form.city}
                disabled={scope === "nationwide"}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value, district: scope === "city" ? "ALL" : p.district }))}
              >
                <option value="ALL">시/도 선택</option>
                {CITY_OPTIONS.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </FieldBox>

            <FieldBox
              label="시/군/구 입력"
              badge={scope === "district" ? "필수" : "자동 전체"}
              help={scope === "district" ? "예: 강남구, 수원시, 해운대구. 해당 시/도 안의 특정 지역만 조회합니다." : "전국 전체 또는 특정 시/도 선택 시 시/군/구는 전체 처리됩니다."}
            >
              <input
                value={scope === "district" ? form.district : "ALL"}
                disabled={scope !== "district"}
                onChange={(e) => setForm((p) => ({ ...p, district: e.target.value.trim() }))}
                placeholder="예: 강남구"
              />
            </FieldBox>

            <FieldBox
              label="조회 시작월"
              badge="YYYYMM"
              help="조회를 시작할 월입니다. 예: 202601 = 2026년 1월"
            >
              <input
                value={form.startMonth}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setForm((p) => ({ ...p, startMonth: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                placeholder="예: 202601"
              />
            </FieldBox>

            <FieldBox
              label="조회 종료월"
              badge="YYYYMM"
              help="조회를 끝낼 마지막 월입니다. 예: 202603 = 2026년 3월"
            >
              <input
                value={form.endMonth}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setForm((p) => ({ ...p, endMonth: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                placeholder="예: 202603"
              />
            </FieldBox>
          </div>

          <div className="molit-summary-strip">
            <div>
              <span>현재 선택 요약</span>
              <strong>{regionSummary} / {monthRangeText} 데이터를 업데이트합니다.</strong>
            </div>
            <button type="button" className="primary-btn" disabled={!canStart} onClick={startImport}>
              {starting ? "실행 요청 중..." : running ? "작업 진행 중" : "시세 데이터 업데이트 시작"}
            </button>
          </div>

          {formInvalidReason ? <div className="molit-invalid-note">{formInvalidReason}</div> : null}
        </div>

        {message ? <div className="api-status success">{message}</div> : null}
        {error ? <div className="api-status error">{error}</div> : null}

        <div className="crm-muted-box" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <strong>{latestJob ? statusText(latestJob.status) : loading ? "불러오는 중" : "대기"}</strong>
            <span>{progress}%</span>
          </div>
          <div className="molit-progress-line">
            <div className="molit-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div style={{ marginTop: 10 }}>
            진행률: <strong>{latestJob?.processed_jobs || 0}</strong> / <strong>{latestJob?.total_jobs || 0}</strong>
            {" · "}신규 저장: <strong>{latestJob?.inserted_rows || 0}</strong>
            {" · "}기존 유지: <strong>{latestJob?.skipped_rows || 0}</strong>
            {" · "}오류: <strong>{latestJob?.error_count || 0}</strong>
            {latestJob?.current_label ? <><br />현재 작업: {latestJob.current_label}</> : null}
            {latestJob?.last_error ? <><br />최근 오류: {latestJob.last_error}</> : null}
          </div>
        </div>
      </section>

      <div className="owner-performance-grid">
        <section className="crm-panel crm-panel-xl">
          <div className="crm-panel-banner">지역별 최신 업데이트 결과</div>
          <div className="crm-table-wrap crm-table-modern-wrap">
            <table className="crm-table crm-table-modern">
              <thead>
                <tr>
                  <th>순번</th>
                  <th>월</th>
                  <th>지역</th>
                  <th>결과</th>
                  <th>신규</th>
                  <th>기존</th>
                  <th>오류</th>
                </tr>
              </thead>
              <tbody>
                {regions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="crm-empty-cell">아직 실행 결과가 없습니다.</td>
                  </tr>
                ) : (
                  regions.slice().reverse().map((row) => (
                    <tr key={row.id || `${row.no}-${row.city}-${row.district}`}>
                      <td>{row.no}</td>
                      <td>{row.month}</td>
                      <td><strong>{[row.city, row.district].filter(Boolean).join(" ")}</strong></td>
                      <td>{resultText(row)}</td>
                      <td>{row.inserted_rows || 0}</td>
                      <td>{row.skipped_rows || 0}</td>
                      <td>{row.error_count || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="crm-panel crm-panel-xl">
          <div className="crm-panel-banner">최근 실행 기록</div>
          <div className="crm-table-wrap crm-table-modern-wrap">
            <table className="crm-table crm-table-modern">
              <thead>
                <tr>
                  <th>실행일</th>
                  <th>범위</th>
                  <th>상태</th>
                  <th>진행률</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={4} className="crm-empty-cell">아직 실행 기록이 없습니다.</td></tr>
                ) : jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.created_at ? formatReviewDateTime(job.created_at) : "-"}</td>
                    <td>{job.city || "ALL"} / {job.district || "ALL"}<br />{job.start_month}~{job.end_month}</td>
                    <td>{statusText(job.status)}</td>
                    <td>{percentOf(job)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
