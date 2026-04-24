"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReviewDateTime } from "../lib-reviews";

const CITY_OPTIONS = [
  "ALL",
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

export default function MolitImportPanel() {
  const defaultMonth = useMemo(() => previousMonthYYYYMM(), []);
  const [tradeStats, setTradeStats] = useState({ summary: null, daily: [], monthly: [], fetched_at: null });
  const [jobs, setJobs] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
    setStarting(true);
    try {
      const res = await fetch("/api/admin/molit-import-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "최신 업데이트 실행에 실패했습니다.");
      setMessage("최신 업데이트 작업을 시작했습니다. 진행률은 자동으로 갱신됩니다.");
      await loadAll({ silent: true });
    } catch (err) {
      setError(err?.message || "최신 업데이트 실행에 실패했습니다.");
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
      <section className="crm-panel crm-panel-xl">
        <div className="crm-section-header">
          <h3>시세조회값 최신 업데이트</h3>
          <span>공공데이터 자동 다운로드·DB 적재·드롭다운 옵션 갱신까지 관리자 페이지에서 실행합니다.</span>
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

        <div className="crm-toolbar crm-toolbar-xl" style={{ marginTop: 18 }}>
          <select value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value, district: "ALL" }))}>
            {CITY_OPTIONS.map((city) => (
              <option key={city} value={city}>{city === "ALL" ? "전국 전체" : city}</option>
            ))}
          </select>
          <input
            value={form.district}
            onChange={(e) => setForm((p) => ({ ...p, district: e.target.value.trim() || "ALL" }))}
            placeholder="시군구: ALL 또는 강남구"
          />
          <input
            value={form.startMonth}
            onChange={(e) => setForm((p) => ({ ...p, startMonth: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
            placeholder="시작월 YYYYMM"
          />
          <input
            value={form.endMonth}
            onChange={(e) => setForm((p) => ({ ...p, endMonth: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
            placeholder="종료월 YYYYMM"
          />
          <button type="button" className="primary-btn" disabled={starting || running} onClick={startImport}>
            {starting ? "실행 요청 중..." : running ? "작업 진행 중" : "최신 업데이트 실행"}
          </button>
        </div>

        {message ? <div className="api-status success">{message}</div> : null}
        {error ? <div className="api-status error">{error}</div> : null}

        <div className="crm-muted-box" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <strong>{latestJob ? statusText(latestJob.status) : loading ? "불러오는 중" : "대기"}</strong>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 12, background: "rgba(15,23,42,.10)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#2563eb,#22c55e)", borderRadius: 999, transition: "width .4s ease" }} />
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
