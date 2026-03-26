"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReviewDateTime } from "../lib-reviews";

const JOB_OPTIONS = ["", "직장인", "사업자", "법인대표", "주부", "프리랜서", "기타"];
const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "new", label: "신규접수" },
  { value: "contacted", label: "재통화예정" },
  { value: "closed", label: "처리완료" },
];
const AUTO_REFRESH_MS = 5000;

function statusLabel(value) {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value || "미정";
}

function LoginView({ form, setForm, loginError, handleLogin }) {
  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container admin-login-shell">
          <form className="review-write-card admin-login-card admin-login-card-pro" onSubmit={handleLogin}>
            <div className="section-mini">직원 전용</div>
            <h1 className="section-title reviews-page-title">직원 CRM 로그인</h1>
            <p className="card-desc">관리자 페이지에서 생성한 직원 계정으로만 접속할 수 있습니다.</p>
            <div className="field">
              <label>직원 아이디</label>
              <input type="text" value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} placeholder="직원 아이디 입력" />
            </div>
            <div className="field">
              <label>직원 비밀번호</label>
              <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="직원 비밀번호 입력" />
            </div>
            {loginError ? <div className="api-status error">{loginError}</div> : null}
            <button type="submit" className="primary-btn">로그인</button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, handleLogout, account }) {
  const tabs = [
    { key: "overview", label: "전체 요약" },
    { key: "customers", label: "배정 고객" },
  ];

  return (
    <aside className="crm-sidebar crm-sidebar-large">
      <div className="crm-sidebar-brand">
        <div className="crm-sidebar-eyebrow">직원 전용</div>
        <strong>상담 CRM</strong>
        <span>{account?.display_name || account?.username || "직원"}님에게 배정된 고객만 표시됩니다.</span>
      </div>
      <nav className="crm-sidebar-nav">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" className={`crm-sidebar-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </nav>
      <button type="button" className="nav-btn admin-logout-btn crm-sidebar-logout" onClick={handleLogout}>로그아웃</button>
    </aside>
  );
}

function SummaryCard({ title, value, subtitle, tone = "default" }) {
  return <div className={`crm-summary-card crm-tone-${tone}`}><span>{title}</span><strong>{value}</strong><small>{subtitle}</small></div>;
}

export default function StaffPage() {
  const [authenticated, setAuthenticated] = useState(null);
  const [account, setAccount] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({ q: "", status: "all", loanType: "all" });
  const [form, setForm] = useState({ status: "new", job_type: "", call_summary: "", internal_memo: "", email: "" });
  const [notes, setNotes] = useState([]);
  const [noteAuthor, setNoteAuthor] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    fetch("/api/staff/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setAuthenticated(Boolean(d.authenticated));
        setAccount(d.account || null);
        setNoteAuthor(d.account?.display_name || d.account?.username || "");
      })
      .catch(() => setAuthenticated(false));
  }, []);

  async function loadData({ silent = false } = {}) {
    if (silent) setIsRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/staff/inquiries", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "데이터를 불러오지 못했습니다.");
      setInquiries(data.inquiries || []);
      if (!selectedId && data.inquiries?.length) setSelectedId(data.inquiries[0].id);
      if (selectedId && !data.inquiries?.some((item) => item.id === selectedId)) {
        setSelectedId(data.inquiries?.[0]?.id || null);
      }
      setLastSyncedAt(new Date());
    } finally {
      if (silent) setIsRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    if (authenticated) {
      loadData().catch((e) => {
        setSaveMessage({ type: "error", text: e.message });
        setLoading(false);
      });
    }
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
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authenticated, selectedId]);

  const selectedInquiry = useMemo(() => inquiries.find((item) => item.id === selectedId) || null, [inquiries, selectedId]);
  const loanOptions = useMemo(() => ["all", ...Array.from(new Set(inquiries.map((item) => item.loan_type).filter(Boolean)))], [inquiries]);

  useEffect(() => {
    if (!selectedInquiry) return;
    setForm({
      status: selectedInquiry.status || "new",
      job_type: selectedInquiry.job_type || "",
      call_summary: selectedInquiry.call_summary || "",
      internal_memo: selectedInquiry.internal_memo || "",
      email: selectedInquiry.email || "",
    });
    fetch(`/api/staff/inquiries/${selectedInquiry.id}/notes`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setNotes(d.notes || []))
      .catch(() => setNotes([]));
  }, [selectedInquiry]);

  const filteredInquiries = useMemo(() => inquiries.filter((item) => {
    const q = filters.q.trim().toLowerCase();
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.loanType !== "all" && item.loan_type !== filters.loanType) return false;
    if (!q) return true;
    return [item.name, item.phone, item.assignee, item.call_summary, item.loan_type].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  }), [inquiries, filters]);

  const stats = useMemo(() => ({
    total: inquiries.length,
    newCount: inquiries.filter((x) => x.status === "new").length,
    contactedCount: inquiries.filter((x) => x.status === "contacted").length,
    closedCount: inquiries.filter((x) => x.status === "closed").length,
  }), [inquiries]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return setLoginError(data.message || "로그인에 실패했습니다.");
    setAccount(data.account || null);
    setNoteAuthor(data.account?.display_name || data.account?.username || "");
    setLoginForm({ username: "", password: "" });
    setAuthenticated(true);
  }

  async function handleLogout() {
    await fetch("/api/staff/logout", { method: "POST" });
    setAuthenticated(false);
    setAccount(null);
  }

  async function handleSave() {
    if (!selectedInquiry) return;
    setSaving(true);
    setSaveMessage(null);
    const res = await fetch(`/api/staff/inquiries/${selectedInquiry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setSaveMessage({ type: "error", text: data.message || "저장 실패" });
      setSaving(false);
      return;
    }
    setInquiries((prev) => prev.map((item) => item.id === selectedInquiry.id ? { ...item, ...data.inquiry } : item));
    setSaveMessage({ type: "success", text: "고객 정보가 저장되었습니다." });
    setSaving(false);
  }

  async function handleAddNote() {
    if (!selectedInquiry || !noteAuthor.trim() || !noteContent.trim()) return;
    setNoteSaving(true);
    const res = await fetch(`/api/staff/inquiries/${selectedInquiry.id}/notes`, {
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

  if (authenticated === null) return <div className="site-wrap"><main className="section"><div className="container">로딩 중...</div></main></div>;
  if (!authenticated) return <LoginView form={loginForm} setForm={setLoginForm} loginError={loginError} handleLogin={handleLogin} />;

  return (
    <div className="site-wrap admin-wrap crm-app-shell">
      <main className="crm-layout crm-layout-wide">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout} account={account} />
        <section className="crm-content crm-content-wide">
          <header className="crm-page-header crm-page-header-xl">
            <div>
              <div className="section-mini">직원 전용 페이지</div>
              <h1>배정 고객 상담 관리</h1>
              <p>관리자가 배정한 고객만 표시되며, 다른 담당자 고객정보는 볼 수 없습니다.</p>
            </div>
          </header>

          {activeTab === "overview" ? (
            <div className="crm-overview-grid owner-overview-grid">
              <div className="crm-summary-grid crm-summary-grid-pro">
                <SummaryCard title="내 배정 고객" value={stats.total} subtitle="현재 내가 담당 중인 고객" />
                <SummaryCard title="신규 접수" value={stats.newCount} subtitle="확인 대기" tone="new" />
                <SummaryCard title="재통화 예정" value={stats.contactedCount} subtitle="후속 상담 필요" tone="contacted" />
                <SummaryCard title="처리 완료" value={stats.closedCount} subtitle="상담 종료" tone="closed" />
              </div>
            </div>
          ) : null}

          <div className="crm-customers-layout">
            <section className="crm-panel crm-panel-xl">
              <div className="crm-section-header"><h3>배정 고객 목록</h3><span>고객명 · 연락처 · 대출상품 기준 검색</span></div>
              <div className="crm-sync-status">{isRefreshing ? "자동 새로고침 중..." : lastSyncedAt ? `최근 동기화 ${formatReviewDateTime(lastSyncedAt)}` : "동기화 대기 중"}</div>
              <div className="crm-toolbar crm-toolbar-xl">
                <input value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="고객명, 연락처, 상품 검색" />
                <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>{STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                <select value={filters.loanType} onChange={(e) => setFilters((p) => ({ ...p, loanType: e.target.value }))}>{loanOptions.map((item) => <option key={item} value={item}>{item === "all" ? "전체 상품" : item}</option>)}</select>
              </div>
              <div className="crm-table-wrap crm-table-modern-wrap">
                <table className="crm-table crm-table-modern">
                  <thead><tr><th>고객명</th><th>연락처</th><th>대출상품</th><th>담당자</th><th>상태</th><th>접수일시</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={6} className="crm-empty-cell">불러오는 중...</td></tr> : null}
                    {!loading && filteredInquiries.length === 0 ? <tr><td colSpan={6} className="crm-empty-cell">현재 배정된 고객이 없습니다.</td></tr> : null}
                    {!loading && filteredInquiries.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className={item.id === selectedId ? "crm-row-selected" : ""}>
                        <td><strong>{item.name}</strong></td>
                        <td>{item.phone}</td>
                        <td>{item.loan_type || "미입력"}</td>
                        <td>{item.assignee || account?.display_name || "미배정"}</td>
                        <td><span className={`crm-status-chip crm-status-${item.status || "new"}`}>{statusLabel(item.status)}</span></td>
                        <td>{formatReviewDateTime(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="crm-detail-shell">
              <section className="crm-panel crm-panel-xl">
                <div className="crm-section-header"><h3>고객 상세</h3><span>{selectedInquiry ? `${selectedInquiry.name} 고객 정보` : "고객을 선택해주세요."}</span></div>
                {!selectedInquiry ? <div className="crm-empty-state">왼쪽 목록에서 고객을 선택하면 상세 정보와 상담 이력을 볼 수 있습니다.</div> : (
                  <>
                    <div className="crm-classic-grid-xl">
                      <div className="crm-classic-row"><span>고객명</span><strong>{selectedInquiry.name}</strong></div>
                      <div className="crm-classic-row"><span>연락처</span><strong>{selectedInquiry.phone}</strong></div>
                      <div className="crm-classic-row"><span>담당자</span><strong>{selectedInquiry.assignee || account?.display_name || "미배정"}</strong></div>
                      <div className="crm-classic-row"><span>대출상품</span><strong>{selectedInquiry.loan_type || "미입력"}</strong></div>
                      <div className="crm-classic-row"><span>주소</span><strong>{selectedInquiry.address || "미입력"}</strong></div>
                      <div className="crm-classic-row crm-classic-row-wide"><span>접수 메모</span><strong>{selectedInquiry.memo || "입력된 메모가 없습니다."}</strong></div>
                    </div>
                    <div className="crm-form-grid-xl" style={{ marginTop: 18 }}>
                      <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>{STATUS_OPTIONS.filter((item) => item.value !== "all").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                      <select value={form.job_type} onChange={(e) => setForm((prev) => ({ ...prev, job_type: e.target.value }))}>{JOB_OPTIONS.map((item) => <option key={item} value={item}>{item || "직군 선택"}</option>)}</select>
                      <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="이메일" />
                      <textarea className="crm-field-wide" value={form.call_summary} onChange={(e) => setForm((prev) => ({ ...prev, call_summary: e.target.value }))} placeholder="통화 요약" />
                      <textarea className="crm-field-wide" value={form.internal_memo} onChange={(e) => setForm((prev) => ({ ...prev, internal_memo: e.target.value }))} placeholder="내부 메모" />
                    </div>
                    {saveMessage ? <div className={`api-status ${saveMessage.type}`}>{saveMessage.text}</div> : null}
                    <button type="button" className="primary-btn crm-save-btn" disabled={saving} onClick={handleSave}>{saving ? "저장 중..." : "고객 정보 저장"}</button>
                  </>
                )}
              </section>

              <section className="crm-panel crm-panel-xl">
                <div className="crm-section-header"><h3>상담 이력</h3><span>내가 담당하는 고객의 이력을 누적합니다.</span></div>
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
        </section>
      </main>
    </div>
  );
}
