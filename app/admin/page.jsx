"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReviewDateTime } from "../lib-reviews";
import { subscribeSupabaseTable } from "../../lib/realtime-browser";

const JOB_OPTIONS = ["", "직장인", "사업자", "법인대표", "프리랜서", "무직"];
const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "신규접수", label: "신규접수" },
  { value: "부재", label: "부재" },
  { value: "재통화예정", label: "재통화예정" },
  { value: "보류", label: "보류" },
  { value: "부결", label: "부결" },
  { value: "진행중", label: "진행중" },
  { value: "가승인", label: "가승인" },
  { value: "승인", label: "승인" },
];

const OWNER_TABS = [
  { key: "customers", label: "고객 배정" },
  { key: "performance", label: "실적 관리" },
  { key: "staff", label: "담당자·직원 계정" },
];
const AUTO_REFRESH_MS = 5000;

function SummaryCard({ title, value, subtitle, tone = "default" }) {
  return <div className={`crm-summary-card crm-tone-${tone}`}><span>{title}</span><strong>{value}</strong><small>{subtitle}</small></div>;
}

function statusLabel(value) {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value || "미정";
}

function statusClassName(value) {
  const map = {
    신규접수: "crm-status-new",
    부재: "crm-status-absent",
    재통화예정: "crm-status-recall",
    보류: "crm-status-hold",
    부결: "crm-status-rejected",
    진행중: "crm-status-progress",
    가승인: "crm-status-preapproved",
    승인: "crm-status-approved",
    active: "crm-status-progress",
    inactive: "crm-status-rejected",
  };
  return map[value] || "crm-status-default";
}

function OwnerLogin({ password, setPassword, error, onSubmit }) {
  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container admin-login-shell">
          <form className="review-write-card admin-login-card admin-login-card-pro" onSubmit={onSubmit}>
            <div className="section-mini">사장님 · 관리자 전용</div>
            <h1 className="section-title reviews-page-title">경영 관리 로그인</h1>
            <p className="card-desc">신규 접수 확인, 담당자 배정, 직원 계정 운영을 관리하는 전용 화면입니다.</p>
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
        <span>전체 고객 열람 · 담당자 배정 · 직원 계정 관리</span>
      </div>
      <nav className="crm-sidebar-nav">
        {OWNER_TABS.map((tab) => <button key={tab.key} type="button" className={`crm-sidebar-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
      </nav>
      <a className="nav-btn crm-ghost-link" href="/staff">직원 페이지 열기</a>
      <a className="nav-btn crm-ghost-link" href="/manage">홈페이지 관리 열기</a>
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
  const [activeTab, setActiveTab] = useState("customers");
  const [inquiries, setInquiries] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStaff, setNewStaff] = useState({ name: "", note: "" });
  const [newAccount, setNewAccount] = useState({ username: "", password: "", display_name: "", staff_member_id: "" });
  const [staffMessage, setStaffMessage] = useState(null);
  const [accountMessage, setAccountMessage] = useState(null);
  const [customerMessage, setCustomerMessage] = useState(null);
  const [metricYear, setMetricYear] = useState("all");
  const [metricMonth, setMetricMonth] = useState("all");
  const [resetPasswords, setResetPasswords] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({ q: "", status: "all", loanType: "all", assignee: "all" });
  const [form, setForm] = useState({ status: "신규접수", job_type: "", assignee: "미배정", assigned_staff_account_id: "", call_summary: "", internal_memo: "" });
  const [notes, setNotes] = useState([]);
  const [noteAuthor, setNoteAuthor] = useState("관리자");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" }).then((r) => r.json()).then((d) => setAuthenticated(Boolean(d.authenticated))).catch(() => setAuthenticated(false));
  }, []);

  async function loadData({ silent = false } = {}) {
    if (silent) setIsRefreshing(true);
    else setLoading(true);
    try {
      const [inqRes, assRes, accRes] = await Promise.all([
        fetch("/api/admin/inquiries", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/assignees", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/staff-accounts", { cache: "no-store" }).then((r) => r.json()),
      ]);
      const nextInquiries = inqRes.inquiries || [];
      setInquiries(nextInquiries);
      setAssignees(assRes.assignees || []);
      setAccounts(accRes.accounts || []);
      if (!selectedId && nextInquiries.length) setSelectedId(nextInquiries[0].id);
      if (selectedId && !nextInquiries.some((item) => item.id === selectedId)) setSelectedId(nextInquiries[0]?.id || null);
      setLastSyncedAt(new Date());
    } finally {
      if (silent) setIsRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    loadData().catch(() => setLoading(false));
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      loadData({ silent: true }).catch(() => null);
    };
    const interval = window.setInterval(refresh, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const unsubscribeInquiries = subscribeSupabaseTable({ table: "inquiries", onChange: refresh });
    const unsubscribeAccounts = subscribeSupabaseTable({ table: "staff_accounts", onChange: refresh });
    const unsubscribeAssignees = subscribeSupabaseTable({ table: "staff_members", onChange: refresh });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribeInquiries?.();
      unsubscribeAccounts?.();
      unsubscribeAssignees?.();
    };
  }, [authenticated, selectedId]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await res.json();
    if (!res.ok || !data.ok) return setError(data.message || "로그인 실패");
    setAuthenticated(true);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
  }

  async function addAssignee(e) {
    e.preventDefault();
    setStaffMessage(null);
    const res = await fetch("/api/admin/assignees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newStaff) });
    const data = await res.json();
    if (!res.ok || !data.ok) return setStaffMessage({ type: "error", text: data.message || "담당자 등록 실패" });
    setNewStaff({ name: "", note: "" });
    setAssignees((prev) => [data.assignee, ...prev]);
    setStaffMessage({ type: "success", text: "신규 담당자가 등록되었습니다." });
  }

  async function patchAssignee(id, body) {
    const res = await fetch(`/api/admin/assignees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok && data.ok) setAssignees((prev) => prev.map((item) => item.id === id ? { ...item, ...data.assignee } : item));
  }

  async function deleteAssignee(id) {
    const res = await fetch(`/api/admin/assignees/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok && data.ok) setAssignees((prev) => prev.filter((item) => item.id !== id));
  }

  async function addStaffAccount(e) {
    e.preventDefault();
    setAccountMessage(null);
    const payload = {
      username: newAccount.username,
      password: newAccount.password,
      display_name: newAccount.display_name,
      staff_member_id: newAccount.staff_member_id || null,
    };
    const res = await fetch("/api/admin/staff-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.ok) return setAccountMessage({ type: "error", text: data.message || "직원 계정 생성 실패" });
    setAccounts((prev) => [data.account, ...prev]);
    setNewAccount({ username: "", password: "", display_name: "", staff_member_id: "" });
    setAccountMessage({ type: "success", text: "직원 계정이 생성되었습니다. 이제 해당 계정으로 직원 페이지 로그인 가능합니다." });
  }

  async function patchAccount(id, body) {
    const res = await fetch(`/api/admin/staff-accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok && data.ok) {
      setAccounts((prev) => prev.map((item) => item.id === id ? { ...item, ...data.account } : item));
      setAccountMessage({ type: "success", text: "직원 계정이 수정되었습니다." });
    } else {
      setAccountMessage({ type: "error", text: data.message || "직원 계정 수정 실패" });
    }
  }

  async function deleteAccount(id) {
    const res = await fetch(`/api/admin/staff-accounts/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok && data.ok) setAccounts((prev) => prev.filter((item) => item.id !== id));
  }

  const selectedInquiry = useMemo(() => inquiries.find((item) => item.id === selectedId) || null, [inquiries, selectedId]);
  const activeAssigneeOptions = useMemo(() => assignees.filter((item) => item.status === "active"), [assignees]);
  const activeAccountOptions = useMemo(() => accounts.filter((item) => item.status === "active"), [accounts]);
  const accountLabelMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => {
      const linked = assignees.find((assignee) => assignee.id === account.staff_member_id);
      map.set(account.id, linked?.name || account.display_name || account.username);
    });
    return map;
  }, [accounts, assignees]);

  useEffect(() => {
    if (!selectedInquiry) return;
    setForm({
      status: selectedInquiry.status || "신규접수",
      job_type: selectedInquiry.job_type || "",
      assignee: selectedInquiry.assignee || "미배정",
      assigned_staff_account_id: selectedInquiry.assigned_staff_account_id || "",
      call_summary: selectedInquiry.call_summary || "",
      internal_memo: selectedInquiry.internal_memo || "",
    });
    fetch(`/api/admin/inquiries/${selectedInquiry.id}/notes`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setNotes(d.notes || []))
      .catch(() => setNotes([]));
  }, [selectedInquiry]);

  const stats = useMemo(() => {
    const total = inquiries.length;
    const activeAssignees = assignees.filter((x) => x.status === "active").length;
    const activeAccounts = accounts.filter((x) => x.status === "active").length;
    const assigned = inquiries.filter((x) => x.assigned_staff_account_id).length;
    const unassigned = inquiries.filter((x) => !x.assigned_staff_account_id).length;
    return { total, activeAssignees, activeAccounts, assigned, unassigned };
  }, [inquiries, assignees, accounts]);

  const yearOptions = useMemo(() => ["all", ...Array.from(new Set(inquiries.map((item) => String(new Date(item.created_at).getFullYear())))).sort((a, b) => b.localeCompare(a))], [inquiries]);

  const performanceRows = useMemo(() => {
    const filtered = inquiries.filter((item) => {
      const d = new Date(item.created_at);
      if (metricYear !== "all" && String(d.getFullYear()) !== metricYear) return false;
      if (metricMonth !== "all" && String(d.getMonth() + 1).padStart(2, "0") !== metricMonth) return false;
      return true;
    });
    const map = new Map();
    filtered.forEach((item) => {
      const name = item.assignee || "미배정";
      const prev = map.get(name) || { name, total: 0, newCount: 0, contactedCount: 0, closedCount: 0 };
      prev.total += 1;
      if (item.status === "신규접수") prev.newCount += 1;
      if (item.status === "진행중" || item.status === "재통화예정" || item.status === "가승인") prev.contactedCount += 1;
      if (item.status === "승인") prev.closedCount += 1;
      map.set(name, prev);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [inquiries, metricYear, metricMonth]);

  const yearlyRows = useMemo(() => groupCounts(inquiries, (item) => String(new Date(item.created_at).getFullYear())).sort((a, b) => b.name.localeCompare(a.name)), [inquiries]);
  const monthlyRows = useMemo(() => groupCounts(inquiries, (item) => `${new Date(item.created_at).getFullYear()}-${String(new Date(item.created_at).getMonth() + 1).padStart(2, "0")}`).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 12), [inquiries]);
  const loanOptions = useMemo(() => ["all", ...Array.from(new Set(inquiries.map((item) => item.loan_type).filter(Boolean)))], [inquiries]);
  const assigneeFilterOptions = useMemo(() => ["all", "unassigned", ...activeAccountOptions.map((item) => item.id)], [activeAccountOptions]);

  const filteredInquiries = useMemo(() => inquiries.filter((item) => {
    const q = filters.q.trim().toLowerCase();
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.loanType !== "all" && item.loan_type !== filters.loanType) return false;
    if (filters.assignee === "unassigned" && item.assigned_staff_account_id) return false;
    if (filters.assignee !== "all" && filters.assignee !== "unassigned" && item.assigned_staff_account_id !== filters.assignee) return false;
    if (!q) return true;
    return [item.name, item.phone, item.assignee, item.call_summary, item.loan_type].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  }), [inquiries, filters]);

  async function handleCustomerSave() {
    if (!selectedInquiry) return;
    setSaving(true);
    setCustomerMessage(null);
    const res = await fetch(`/api/admin/inquiries/${selectedInquiry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setCustomerMessage({ type: "error", text: data.message || "저장 실패" });
      setSaving(false);
      return;
    }
    setInquiries((prev) => prev.map((item) => item.id === selectedInquiry.id ? { ...item, ...data.inquiry } : item));
    setCustomerMessage({ type: "success", text: "고객 정보와 담당자 배정이 저장되었습니다." });
    setSaving(false);
  }



  async function handleAddNote() {
    if (!selectedInquiry || !noteAuthor.trim() || !noteContent.trim()) return;
    setNoteSaving(true);
    const res = await fetch(`/api/admin/inquiries/${selectedInquiry.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: noteAuthor, content: noteContent }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setNotes((prev) => [data.note, ...prev]);
      setNoteContent("");
    }
    setNoteSaving(false);
  }

  function handleAssignmentChange(accountId) {
    const normalized = accountId || "";
    setForm((prev) => ({
      ...prev,
      assigned_staff_account_id: normalized,
      assignee: normalized ? (accountLabelMap.get(normalized) || "미배정") : "미배정",
    }));
  }

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
              <h1>전체 고객 관리 및 담당자 배정</h1>
              <p>관리자는 전체 신규접수를 보고 담당자를 배정할 수 있고, 직원은 자신에게 배정된 고객만 볼 수 있습니다.</p>
            </div>
          </header>

          {activeTab === "customers" ? (
            <>
              <div className="crm-summary-grid crm-summary-grid-pro" style={{ marginBottom: 20 }}>
                <SummaryCard title="전체 접수" value={stats.total} subtitle="누적 상담 건수" />
                <SummaryCard title="배정 완료" value={stats.assigned} subtitle="담당자 배정된 고객" tone="contacted" />
                <SummaryCard title="미배정" value={stats.unassigned} subtitle="아직 배정 안 된 고객" tone="new" />
                <SummaryCard title="활성 직원 계정" value={stats.activeAccounts} subtitle="배정 가능한 계정 수" tone="closed" />
              </div>
              <div className="crm-assignment-banner">
                <div>
                  <strong>담당자 배정이 가장 중요합니다.</strong>
                  <span>신규접수나 미배정 고객을 먼저 확인한 뒤 담당자를 지정하면, 해당 직원 페이지에 바로 노출됩니다.</span>
                </div>
                <div className="crm-assignment-banner-stats">
                  <b>{stats.unassigned}</b>
                  <small>현재 미배정 고객</small>
                </div>
              </div>
              <div className="crm-customers-layout crm-customers-layout-expanded">
                <section className="crm-panel crm-panel-xl">
                  <div className="crm-section-header"><h3>전체 고객 현황</h3><span>신규 접수 확인 후 담당자를 배정하세요.</span></div>
                  <div className="crm-sync-status">{isRefreshing ? "자동 새로고침 중..." : lastSyncedAt ? `최근 동기화 ${formatReviewDateTime(lastSyncedAt)}` : "동기화 대기 중"}</div>
                  <div className="crm-toolbar crm-toolbar-xl crm-toolbar-4">
                    <input value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="고객명, 연락처, 담당자 검색" />
                    <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>{STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                    <select value={filters.loanType} onChange={(e) => setFilters((p) => ({ ...p, loanType: e.target.value }))}>{loanOptions.map((item) => <option key={item} value={item}>{item === "all" ? "전체 상품" : item}</option>)}</select>
                    <select value={filters.assignee} onChange={(e) => setFilters((p) => ({ ...p, assignee: e.target.value }))}>
                      <option value="all">전체 담당자</option>
                      <option value="unassigned">미배정</option>
                      {activeAccountOptions.map((item) => <option key={item.id} value={item.id}>{accountLabelMap.get(item.id) || item.display_name || item.username}</option>)}
                    </select>
                  </div>
                  <div className="crm-table-wrap crm-table-modern-wrap crm-table-no-scroll">
                    <table className="crm-table crm-table-modern crm-table-fixed">
                      <colgroup><col style={{ width: "14%" }} /><col style={{ width: "14%" }} /><col style={{ width: "18%" }} /><col style={{ width: "16%" }} /><col style={{ width: "12%" }} /><col style={{ width: "26%" }} /></colgroup>
                      <thead><tr><th>고객명</th><th>연락처</th><th>대출상품</th><th>담당자</th><th>상태</th><th>접수일시</th></tr></thead>
                      <tbody>
                        {loading ? <tr><td colSpan={6} className="crm-empty-cell">불러오는 중...</td></tr> : null}
                        {!loading && filteredInquiries.length === 0 ? <tr><td colSpan={6} className="crm-empty-cell">검색 결과가 없습니다.</td></tr> : null}
                        {!loading && filteredInquiries.map((item) => (
                          <tr key={item.id} onClick={() => setSelectedId(item.id)} className={item.id === selectedId ? "crm-row-selected" : ""}>
                            <td><strong>{item.name}</strong></td>
                            <td>{item.phone}</td>
                            <td>{item.loan_type || "미입력"}</td>
                            <td>{item.assignee || "미배정"}</td>
                            <td><span className={`crm-status-chip ${statusClassName(item.status)}`}>{statusLabel(item.status)}</span></td>
                            <td>{formatReviewDateTime(item.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="crm-detail-shell">
                  <section className="crm-panel crm-panel-xl">
                    <div className="crm-section-header"><h3>고객 상세 및 담당자 배정</h3><span>{selectedInquiry ? `${selectedInquiry.name} 고객 관리` : "고객을 선택해주세요."}</span></div>
                    {!selectedInquiry ? <div className="crm-empty-state">왼쪽 목록에서 고객을 선택하면 배정과 상담기록을 관리할 수 있습니다.</div> : (
                      <>
                        <div className="crm-classic-grid-xl">
                          <div className="crm-classic-row"><span>고객명</span><strong>{selectedInquiry.name}</strong></div>
                          <div className="crm-classic-row"><span>연락처</span><strong>{selectedInquiry.phone}</strong></div>
                          <div className="crm-classic-row"><span>현재 담당자</span><strong>{selectedInquiry.assignee || "미배정"}</strong></div>
                          <div className="crm-classic-row"><span>대출상품</span><strong>{selectedInquiry.loan_type || "미입력"}</strong></div>
                          <div className="crm-classic-row"><span>주소</span><strong>{selectedInquiry.address || "미입력"}</strong></div>
                          <div className="crm-classic-row crm-classic-row-wide"><span>접수 메모</span><strong>{selectedInquiry.memo || "입력된 메모가 없습니다."}</strong></div>
                        </div>
                        <div className="crm-assignment-focus-card">
                          <div className="crm-assignment-focus-head">
                            <div>
                              <strong>담당자 배정 / 변경</strong>
                              <span>여기서 담당자를 지정하면 해당 직원 계정 화면에 바로 표시됩니다.</span>
                            </div>
                            <div className={`crm-badge-pill ${form.assigned_staff_account_id ? "assigned" : "unassigned"}`}>{form.assigned_staff_account_id ? "배정 완료" : "미배정"}</div>
                          </div>
                          <div className="crm-form-grid-xl crm-form-grid-assign" style={{ marginTop: 18 }}>
                          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>{STATUS_OPTIONS.filter((item) => item.value !== "all").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                          <select value={form.job_type} onChange={(e) => setForm((prev) => ({ ...prev, job_type: e.target.value }))}>{JOB_OPTIONS.map((item) => <option key={item} value={item}>{item || "직군 선택"}</option>)}</select>
                          <select value={form.assigned_staff_account_id} onChange={(e) => handleAssignmentChange(e.target.value)}>
                            <option value="">담당자 미배정</option>
                            {activeAccountOptions.map((item) => <option key={item.id} value={item.id}>{accountLabelMap.get(item.id) || item.display_name || item.username}</option>)}
                          </select>
                          <textarea className="crm-field-wide" value={form.call_summary} onChange={(e) => setForm((prev) => ({ ...prev, call_summary: e.target.value }))} placeholder="통화 요약" />
                          <textarea className="crm-field-wide" value={form.internal_memo} onChange={(e) => setForm((prev) => ({ ...prev, internal_memo: e.target.value }))} placeholder="내부 메모" />
                        </div>
                        </div>
                        {customerMessage ? <div className={`api-status ${customerMessage.type}`}>{customerMessage.text}</div> : null}
                        <button type="button" className="primary-btn crm-save-btn crm-save-btn-accent" disabled={saving} onClick={handleCustomerSave}>{saving ? "저장 중..." : "담당자 배정 및 고객 정보 저장"}</button>
                      </>
                    )}
                  </section>

                  <section className="crm-panel crm-panel-xl">
                    <div className="crm-section-header"><h3>상담 이력</h3><span>관리자도 전체 고객 이력을 확인하고 기록할 수 있습니다.</span></div>
                    {!selectedInquiry ? <div className="crm-empty-state small">고객을 선택하면 상담 이력을 작성할 수 있습니다.</div> : (
                      <>
                        <div className="crm-notes-composer">
                          <input value={noteAuthor} onChange={(e) => setNoteAuthor(e.target.value)} placeholder="작성자" />
                          <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="상담 내용을 기록하세요" />
                          <button type="button" className="primary-btn" disabled={noteSaving} onClick={handleAddNote}>{noteSaving ? "저장 중..." : "이력 추가"}</button>
                        </div>
                        <div className="crm-note-timeline">
                          {notes.length === 0 ? <div className="crm-empty-state small">아직 등록된 상담 이력이 없습니다.</div> : notes.map((note) => (
                            <article key={note.id} className="crm-note-card">
                              <div className="crm-note-head"><strong>{note.author}</strong><span>{formatReviewDateTime(note.created_at)}</span></div>
                              <p>{note.content}</p>
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                </section>
              </div>
            </>
          ) : null}

          {activeTab === "performance" ? (
            <div className="owner-performance-shell">
              <section className="crm-panel crm-panel-xl">
                <div className="crm-section-header"><h3>담당자별 실적</h3><span>년/월 기준으로 담당자별 상담 건수를 확인합니다.</span></div>
                <div className="crm-toolbar crm-toolbar-xl">
                  <select value={metricYear} onChange={(e) => setMetricYear(e.target.value)}>{yearOptions.map((item) => <option key={item} value={item}>{item === "all" ? "전체 연도" : `${item}년`}</option>)}</select>
                  <select value={metricMonth} onChange={(e) => setMetricMonth(e.target.value)}><option value="all">전체 월</option>{Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => <option key={m} value={m}>{Number(m)}월</option>)}</select>
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



          {activeTab === "staff" ? (
            <div className="owner-staff-shell">
              <section className="crm-panel crm-panel-xl">
                <div className="crm-section-header"><h3>담당자 관리</h3><span>여기서 추가/수정한 담당자는 직원 계정 연결에도 바로 반영됩니다.</span></div>
                <form className="crm-inline-form" onSubmit={addAssignee}>
                  <input value={newStaff.name} onChange={(e) => setNewStaff((p) => ({ ...p, name: e.target.value }))} placeholder="신규 담당자 이름" />
                  <input value={newStaff.note} onChange={(e) => setNewStaff((p) => ({ ...p, note: e.target.value }))} placeholder="소속/메모" />
                  <button type="submit" className="primary-btn">담당자 추가</button>
                </form>
                {staffMessage ? <div className={`api-status ${staffMessage.type}`}>{staffMessage.text}</div> : null}
                <div className="crm-table-wrap crm-table-modern-wrap">
                  <table className="crm-table crm-table-modern">
                    <thead><tr><th>이름</th><th>상태</th><th>메모</th><th>등록일</th><th>관리</th></tr></thead>
                    <tbody>{assignees.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><span className={`crm-status-chip ${statusClassName(item.status)}`}>{item.status === "active" ? "재직" : "퇴사"}</span></td><td>{item.note || "-"}</td><td>{formatReviewDateTime(item.created_at)}</td><td><div className="crm-action-row"><button type="button" className="secondary-btn small" onClick={() => patchAssignee(item.id, { status: item.status === "active" ? "inactive" : "active" })}>{item.status === "active" ? "퇴사 처리" : "재직 전환"}</button><button type="button" className="secondary-btn small danger" onClick={() => deleteAssignee(item.id)}>삭제</button></div></td></tr>)}</tbody>
                  </table>
                </div>
              </section>

              <section className="crm-panel crm-panel-xl">
                <div className="crm-section-header"><h3>직원 로그인 계정 관리</h3><span>관리자 페이지에서 만든 계정으로만 직원 페이지에 로그인할 수 있습니다.</span></div>
                <form className="crm-account-form" onSubmit={addStaffAccount}>
                  <input value={newAccount.username} onChange={(e) => setNewAccount((p) => ({ ...p, username: e.target.value }))} placeholder="로그인 아이디" />
                  <input type="password" value={newAccount.password} onChange={(e) => setNewAccount((p) => ({ ...p, password: e.target.value }))} placeholder="초기 비밀번호" />
                  <input value={newAccount.display_name} onChange={(e) => setNewAccount((p) => ({ ...p, display_name: e.target.value }))} placeholder="표시 이름" />
                  <select value={newAccount.staff_member_id} onChange={(e) => setNewAccount((p) => ({ ...p, staff_member_id: e.target.value, display_name: p.display_name || activeAssigneeOptions.find((item) => item.id === e.target.value)?.name || "" }))}>
                    <option value="">담당자 연결 안함</option>
                    {activeAssigneeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <button type="submit" className="primary-btn">직원 계정 생성</button>
                </form>
                {accountMessage ? <div className={`api-status ${accountMessage.type}`}>{accountMessage.text}</div> : null}
                <div className="crm-table-wrap crm-table-modern-wrap">
                  <table className="crm-table crm-table-modern">
                    <thead><tr><th>표시 이름</th><th>로그인 아이디</th><th>연결 담당자</th><th>상태</th><th>비밀번호 재설정</th><th>관리</th></tr></thead>
                    <tbody>
                      {accounts.length === 0 ? <tr><td colSpan={6} className="crm-empty-cell">등록된 직원 계정이 없습니다.</td></tr> : accounts.map((item) => {
                        const linked = assignees.find((assignee) => assignee.id === item.staff_member_id);
                        return (
                          <tr key={item.id}>
                            <td><strong>{item.display_name || item.username}</strong></td>
                            <td>{item.username}</td>
                            <td>{linked?.name || "-"}</td>
                            <td><span className={`crm-status-chip ${statusClassName(item.status)}`}>{item.status === "active" ? "사용중" : "중지"}</span></td>
                            <td>
                              <div className="crm-action-stack">
                                <input type="password" value={resetPasswords[item.id] || ""} onChange={(e) => setResetPasswords((prev) => ({ ...prev, [item.id]: e.target.value }))} placeholder="새 비밀번호" />
                                <button type="button" className="secondary-btn small" onClick={() => { if (!(resetPasswords[item.id] || "").trim()) return; patchAccount(item.id, { password: resetPasswords[item.id] }); setResetPasswords((prev) => ({ ...prev, [item.id]: "" })); }}>재설정</button>
                              </div>
                            </td>
                            <td>
                              <div className="crm-action-row">
                                <button type="button" className="secondary-btn small" onClick={() => patchAccount(item.id, { status: item.status === "active" ? "inactive" : "active" })}>{item.status === "active" ? "로그인 중지" : "다시 활성화"}</button>
                                <button type="button" className="secondary-btn small danger" onClick={() => deleteAccount(item.id)}>삭제</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
