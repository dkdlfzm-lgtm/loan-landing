"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReviewDateTime } from "../lib-reviews";

const OWNER_TABS = [
  { key: "overview", label: "전체 요약" },
  { key: "performance", label: "실적 관리" },
  { key: "staff", label: "담당자 관리" },
];

function SummaryCard({ title, value, subtitle, tone = "default" }) {
  return <div className={`crm-summary-card crm-tone-${tone}`}><span>{title}</span><strong>{value}</strong><small>{subtitle}</small></div>;
}

function OwnerLogin({ password, setPassword, error, onSubmit }) {
  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container admin-login-shell">
          <form className="review-write-card admin-login-card admin-login-card-pro" onSubmit={onSubmit}>
            <div className="section-mini">사장님 · 관리자 전용</div>
            <h1 className="section-title reviews-page-title">경영 관리 로그인</h1>
            <p className="card-desc">담당자 운영, 날짜별 실적, 전체 상담 현황을 관리하는 전용 화면입니다.</p>
            <div className="field"><label>관리자 비밀번호</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="관리자 비밀번호 입력" /></div>
            {error ? <div className="api-status error">{error}</div> : null}
            <button type="submit" className="primary-btn">로그인</button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, onLogout }) {
  return (
    <aside className="crm-sidebar crm-sidebar-large crm-sidebar-owner">
      <div className="crm-sidebar-brand">
        <div className="crm-sidebar-eyebrow">사장님 · 관리자 전용</div>
        <strong>경영 관리 센터</strong>
        <span>담당자 운영 · 날짜별 실적 · 접수 현황</span>
      </div>
      <nav className="crm-sidebar-nav">
        {OWNER_TABS.map((tab) => <button key={tab.key} type="button" className={`crm-sidebar-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
      </nav>
      <a className="nav-btn crm-ghost-link" href="/staff">직원 페이지 열기</a>
      <button type="button" className="nav-btn admin-logout-btn crm-sidebar-logout" onClick={onLogout}>로그아웃</button>
    </aside>
  );
}

function groupCounts(items, getKey) {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

export default function AdminOwnerPage() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [inquiries, setInquiries] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStaff, setNewStaff] = useState({ name: "", note: "" });
  const [staffMessage, setStaffMessage] = useState(null);
  const [metricYear, setMetricYear] = useState("all");
  const [metricMonth, setMetricMonth] = useState("all");

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" }).then((r) => r.json()).then((d) => setAuthenticated(Boolean(d.authenticated))).catch(() => setAuthenticated(false));
  }, []);

  async function loadData() {
    setLoading(true);
    const [inqRes, assRes] = await Promise.all([
      fetch('/api/admin/inquiries', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/admin/assignees', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    setInquiries(inqRes.inquiries || []);
    setAssignees(assRes.assignees || []);
    setLoading(false);
  }

  useEffect(() => { if (authenticated) loadData().catch(() => setLoading(false)); }, [authenticated]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const data = await res.json();
    if (!res.ok || !data.ok) return setError(data.message || '로그인 실패');
    setAuthenticated(true);
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
  }

  async function addAssignee(e) {
    e.preventDefault();
    setStaffMessage(null);
    const res = await fetch('/api/admin/assignees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newStaff) });
    const data = await res.json();
    if (!res.ok || !data.ok) return setStaffMessage({ type: 'error', text: data.message || '담당자 등록 실패' });
    setNewStaff({ name: '', note: '' });
    setAssignees((prev) => [data.assignee, ...prev]);
    setStaffMessage({ type: 'success', text: '신규 담당자가 등록되었습니다.' });
  }

  async function patchAssignee(id, body) {
    const res = await fetch(`/api/admin/assignees/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok && data.ok) setAssignees((prev) => prev.map((item) => item.id === id ? { ...item, ...data.assignee } : item));
  }

  async function deleteAssignee(id) {
    const res = await fetch(`/api/admin/assignees/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.ok) setAssignees((prev) => prev.filter((item) => item.id !== id));
  }

  const stats = useMemo(() => {
    const total = inquiries.length;
    const activeAssignees = assignees.filter((x) => x.status === 'active').length;
    const assigned = inquiries.filter((x) => x.assignee && x.assignee !== '미배정').length;
    const now = new Date();
    const thisMonth = inquiries.filter((x) => {
      const d = new Date(x.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return { total, activeAssignees, assigned, thisMonth };
  }, [inquiries, assignees]);

  const yearOptions = useMemo(() => ['all', ...Array.from(new Set(inquiries.map((item) => String(new Date(item.created_at).getFullYear())))).sort((a,b)=>b.localeCompare(a))], [inquiries]);

  const performanceRows = useMemo(() => {
    const filtered = inquiries.filter((item) => {
      const d = new Date(item.created_at);
      if (metricYear !== 'all' && String(d.getFullYear()) !== metricYear) return false;
      if (metricMonth !== 'all' && String(d.getMonth() + 1).padStart(2, '0') !== metricMonth) return false;
      return true;
    });
    const map = new Map();
    filtered.forEach((item) => {
      const name = item.assignee || '미배정';
      const prev = map.get(name) || { name, total: 0, newCount: 0, contactedCount: 0, closedCount: 0 };
      prev.total += 1;
      if (item.status === 'new') prev.newCount += 1;
      if (item.status === 'contacted') prev.contactedCount += 1;
      if (item.status === 'closed') prev.closedCount += 1;
      map.set(name, prev);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [inquiries, metricYear, metricMonth]);

  const yearlyRows = useMemo(() => groupCounts(inquiries, (item) => String(new Date(item.created_at).getFullYear())).sort((a,b)=>b.name.localeCompare(a.name)), [inquiries]);
  const monthlyRows = useMemo(() => groupCounts(inquiries, (item) => `${new Date(item.created_at).getFullYear()}-${String(new Date(item.created_at).getMonth()+1).padStart(2,'0')}`).sort((a,b)=>b.name.localeCompare(a.name)).slice(0,12), [inquiries]);

  if (authenticated === null) return <div className="site-wrap"><main className="section"><div className="container">로딩 중...</div></main></div>;
  if (!authenticated) return <OwnerLogin password={password} setPassword={setPassword} error={error} onSubmit={handleLogin} />;

  return (
    <div className="site-wrap admin-wrap crm-app-shell">
      <main className="crm-layout crm-layout-wide">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
        <section className="crm-content crm-content-wide">
          <header className="crm-page-header crm-page-header-xl">
            <div>
              <div className="section-mini">사장님 · 관리자 전용</div>
              <h1>경영 관리 대시보드</h1>
              <p>담당자 운영 현황과 날짜별 실적을 한눈에 볼 수 있게 정리한 관리자 전용 화면입니다.</p>
            </div>
          </header>

          {activeTab === 'overview' ? (
            <div className="owner-overview-grid">
              <div className="crm-summary-grid crm-summary-grid-pro">
                <SummaryCard title="전체 접수" value={stats.total} subtitle="누적 상담 건수" />
                <SummaryCard title="이번 달 접수" value={stats.thisMonth} subtitle="당월 실적" tone="new" />
                <SummaryCard title="활성 담당자" value={stats.activeAssignees} subtitle="현재 재직 중" tone="contacted" />
                <SummaryCard title="배정 완료" value={stats.assigned} subtitle="담당자 배정된 고객" tone="closed" />
              </div>
              <section className="crm-panel crm-panel-xl">
                <div className="crm-panel-banner">최근 접수 현황</div>
                <div className="crm-table-wrap crm-table-modern-wrap">
                  <table className="crm-table crm-table-modern">
                    <thead><tr><th>고객명</th><th>대출상품</th><th>담당자</th><th>상태</th><th>접수일시</th></tr></thead>
                    <tbody>{loading ? <tr><td colSpan={5} className="crm-empty-cell">불러오는 중...</td></tr> : inquiries.slice(0, 12).map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.loan_type || '미입력'}</td><td>{item.assignee || '미배정'}</td><td>{item.status || 'new'}</td><td>{formatReviewDateTime(item.created_at)}</td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'performance' ? (
            <div className="owner-performance-shell">
              <section className="crm-panel crm-panel-xl">
                <div className="crm-section-header"><h3>담당자별 실적</h3><span>년/월 기준으로 담당자별 상담 건수를 확인합니다.</span></div>
                <div className="crm-toolbar crm-toolbar-xl">
                  <select value={metricYear} onChange={(e) => setMetricYear(e.target.value)}>{yearOptions.map((item) => <option key={item} value={item}>{item === 'all' ? '전체 연도' : `${item}년`}</option>)}</select>
                  <select value={metricMonth} onChange={(e) => setMetricMonth(e.target.value)}><option value="all">전체 월</option>{Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => <option key={m} value={m}>{Number(m)}월</option>)}</select>
                  <div className="crm-muted-box">조건 선택 시 담당자별 신규/재통화/처리완료 건수를 즉시 집계합니다.</div>
                </div>
                <div className="crm-table-wrap crm-table-modern-wrap">
                  <table className="crm-table crm-table-modern">
                    <thead><tr><th>담당자</th><th>전체</th><th>신규</th><th>재통화예정</th><th>처리완료</th></tr></thead>
                    <tbody>{performanceRows.length === 0 ? <tr><td colSpan={5} className="crm-empty-cell">조건에 맞는 실적이 없습니다.</td></tr> : performanceRows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.total}</td><td>{row.newCount}</td><td>{row.contactedCount}</td><td>{row.closedCount}</td></tr>)}</tbody>
                  </table>
                </div>
              </section>
              <div className="owner-performance-grid">
                <section className="crm-panel crm-panel-xl"><div className="crm-panel-banner">연도별 접수 건수</div><div className="crm-stats-list">{yearlyRows.map((row) => <div key={row.name} className="crm-stats-row"><strong>{row.name}년</strong><span>{row.count}건</span></div>)}</div></section>
                <section className="crm-panel crm-panel-xl"><div className="crm-panel-banner">월별 접수 건수</div><div className="crm-stats-list">{monthlyRows.map((row) => <div key={row.name} className="crm-stats-row"><strong>{row.name}</strong><span>{row.count}건</span></div>)}</div></section>
              </div>
            </div>
          ) : null}

          {activeTab === 'staff' ? (
            <section className="crm-panel crm-panel-xl">
              <div className="crm-section-header"><h3>담당자 관리</h3><span>여기서 추가/수정한 담당자는 직원 페이지 고객관리 담당자 선택에도 바로 반영됩니다.</span></div>
              <form className="crm-inline-form" onSubmit={addAssignee}>
                <input value={newStaff.name} onChange={(e) => setNewStaff((p) => ({ ...p, name: e.target.value }))} placeholder="신규 담당자 이름" />
                <input value={newStaff.note} onChange={(e) => setNewStaff((p) => ({ ...p, note: e.target.value }))} placeholder="소속/메모" />
                <button type="submit" className="primary-btn">담당자 추가</button>
              </form>
              {staffMessage ? <div className={`api-status ${staffMessage.type}`}>{staffMessage.text}</div> : null}
              <div className="crm-table-wrap crm-table-modern-wrap">
                <table className="crm-table crm-table-modern">
                  <thead><tr><th>이름</th><th>상태</th><th>메모</th><th>등록일</th><th>관리</th></tr></thead>
                  <tbody>{assignees.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><span className={`crm-status-chip ${item.status === 'active' ? 'crm-status-contacted' : 'crm-status-closed'}`}>{item.status === 'active' ? '재직' : '퇴사'}</span></td><td>{item.note || '-'}</td><td>{formatReviewDateTime(item.created_at)}</td><td><div className="crm-action-row"><button type="button" className="secondary-btn small" onClick={() => patchAssignee(item.id, { status: item.status === 'active' ? 'inactive' : 'active' })}>{item.status === 'active' ? '퇴사 처리' : '재직 전환'}</button><button type="button" className="secondary-btn small danger" onClick={() => deleteAssignee(item.id)}>삭제</button></div></td></tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}
