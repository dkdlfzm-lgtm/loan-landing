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

function statusLabel(value) {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value || "미정";
}

function LoginView({ password, setPassword, loginError, handleLogin }) {
  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container admin-login-shell">
          <form className="review-write-card admin-login-card admin-login-card-pro" onSubmit={handleLogin}>
            <div className="section-mini">직원 전용</div>
            <h1 className="section-title reviews-page-title">직원 CRM 로그인</h1>
            <p className="card-desc">고객 정보 확인과 상담 이력 입력 전용 페이지입니다.</p>
            <div className="field"><label>직원 비밀번호</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="직원 비밀번호 입력" /></div>
            {loginError ? <div className="api-status error">{loginError}</div> : null}
            <button type="submit" className="primary-btn">로그인</button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, handleLogout }) {
  const tabs = [
    { key: "overview", label: "전체 요약" },
    { key: "customers", label: "고객관리" },
  ];
  return (
    <aside className="crm-sidebar crm-sidebar-large">
      <div className="crm-sidebar-brand">
        <div className="crm-sidebar-eyebrow">직원 전용</div>
        <strong>상담 CRM</strong>
        <span>고객 확인 · 처리상태 · 상담 이력</span>
      </div>
      <nav className="crm-sidebar-nav">
        {tabs.map((tab) => <button key={tab.key} type="button" className={`crm-sidebar-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
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
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({ q: "", status: "all", loanType: "all" });
  const [form, setForm] = useState({ status: "new", job_type: "", assignee: "미배정", call_summary: "", internal_memo: "", email: "" });
  const [notes, setNotes] = useState([]);
  const [noteAuthor, setNoteAuthor] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    fetch("/api/staff/session", { cache: "no-store" }).then((r) => r.json()).then((d) => setAuthenticated(Boolean(d.authenticated))).catch(() => setAuthenticated(false));
  }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetch("/api/staff/inquiries", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || "데이터를 불러오지 못했습니다.");
    setInquiries(data.inquiries || []);
    setAssignees(data.assignees || []);
    if (!selectedId && data.inquiries?.length) setSelectedId(data.inquiries[0].id);
    setLoading(false);
  }

  useEffect(() => {
    if (authenticated) loadData().catch((e) => { setSaveMessage({ type: "error", text: e.message }); setLoading(false); });
  }, [authenticated]);

  const selectedInquiry = useMemo(() => inquiries.find((item) => item.id === selectedId) || null, [inquiries, selectedId]);
  const assigneeOptions = useMemo(() => ["미배정", ...assignees.filter((item) => item.status === "active").map((item) => item.name)], [assignees]);
  const loanOptions = useMemo(() => ["all", ...Array.from(new Set(inquiries.map((item) => item.loan_type).filter(Boolean)))], [inquiries]);

  useEffect(() => {
    if (!selectedInquiry) return;
    setForm({
      status: selectedInquiry.status || "new",
      job_type: selectedInquiry.job_type || "",
      assignee: selectedInquiry.assignee || "미배정",
      call_summary: selectedInquiry.call_summary || "",
      internal_memo: selectedInquiry.internal_memo || "",
      email: selectedInquiry.email || "",
    });
    fetch(`/api/staff/inquiries/${selectedInquiry.id}/notes`, { cache: "no-store" }).then((r) => r.json()).then((d) => setNotes(d.notes || [])).catch(() => setNotes([]));
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
    const res = await fetch("/api/staff/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await res.json();
    if (!res.ok || !data.ok) return setLoginError(data.message || "로그인에 실패했습니다.");
    setAuthenticated(true);
  }

  async function handleLogout() {
    await fetch("/api/staff/logout", { method: "POST" });
    setAuthenticated(false);
  }

  async function handleSave() {
    if (!selectedInquiry) return;
    setSaving(true);
    setSaveMessage(null);
    const res = await fetch(`/api/staff/inquiries/${selectedInquiry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
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
    const res = await fetch(`/api/staff/inquiries/${selectedInquiry.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: noteAuthor, content: noteContent }) });
    const data = await res.json();
    if (res.ok && data.ok) {
      setNotes((prev) => [data.note, ...prev]);
      setNoteContent("");
    }
    setNoteSaving(false);
  }

  if (authenticated === null) return <div className="site-wrap"><main className="section"><div className="container">로딩 중...</div></main></div>;
  if (!authenticated) return <LoginView password={password} setPassword={setPassword} loginError={loginError} handleLogin={handleLogin} />;

  return (
    <div className="site-wrap admin-wrap crm-app-shell">
      <main className="crm-layout crm-layout-wide">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout} />
        <section className="crm-content crm-content-wide">
          <header className="crm-page-header crm-page-header-xl">
            <div>
              <div className="section-mini">직원 전용 페이지</div>
              <h1>고객 상담 관리</h1>
              <p>고객 정보와 상담 이력을 빠르게 확인하고 다음 담당자에게 자연스럽게 인계할 수 있도록 구성했습니다.</p>
            </div>
          </header>
          {activeTab === "overview" ? (
            <div className="crm-overview-grid owner-overview-grid">
              <div className="crm-summary-grid crm-summary-grid-pro">
                <SummaryCard title="전체 접수" value={stats.total} subtitle="누적 상담 건수" />
                <SummaryCard title="신규 접수" value={stats.newCount} subtitle="확인 대기" tone="new" />
                <SummaryCard title="재통화 예정" value={stats.contactedCount} subtitle="후속 상담 필요" tone="contacted" />
                <SummaryCard title="처리 완료" value={stats.closedCount} subtitle="상담 종료" tone="closed" />
              </div>
            </div>
          ) : null}
          <div className="crm-customers-layout">
            <section className="crm-panel crm-panel-xl">
              <div className="crm-section-header"><h3>고객 현황</h3><span>고객명 · 연락처 · 대출상품 · 담당자 기준 검색</span></div>
              <div className="crm-toolbar crm-toolbar-xl">
                <input value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="고객명, 연락처, 담당자 검색" />
                <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>{STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                <select value={filters.loanType} onChange={(e) => setFilters((p) => ({ ...p, loanType: e.target.value }))}>{loanOptions.map((item) => <option key={item} value={item}>{item === "all" ? "전체 상품" : item}</option>)}</select>
              </div>
              <div className="crm-table-wrap crm-table-modern-wrap crm-list-wrap">
                <table className="crm-table crm-table-modern crm-table-compact">
                  <thead><tr><th>고객명</th><th>대출상품</th><th>자격구분</th><th>담당자</th><th>상태</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={5} className="crm-empty-cell">불러오는 중...</td></tr> : filteredInquiries.length === 0 ? <tr><td colSpan={5} className="crm-empty-cell">표시할 접수 내역이 없습니다.</td></tr> : filteredInquiries.map((item) => (
                      <tr key={item.id} className={selectedId === item.id ? "is-active" : ""} onClick={() => setSelectedId(item.id)}>
                        <td><strong>{item.name}</strong><div className="crm-subtext">{item.phone}</div></td>
                        <td>{item.loan_type || "미입력"}</td>
                        <td>{item.job_type || "미입력"}</td>
                        <td>{item.assignee || "미배정"}</td>
                        <td><span className={`crm-status-chip crm-status-${item.status || "new"}`}>{statusLabel(item.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedInquiry ? (
              <section className="crm-detail-shell">
                <div className="crm-detail-grid-large">
                  <section className="crm-panel crm-classic-panel crm-panel-xl">
                    <div className="crm-panel-banner">고객정보</div>
                    <div className="crm-classic-grid crm-classic-grid-xl">
                      <div className="crm-classic-row"><span>고객명</span><strong>{selectedInquiry.name}</strong></div>
                      <div className="crm-classic-row"><span>연락처</span><strong>{selectedInquiry.phone}</strong></div>
                      <div className="crm-classic-row"><span>자격구분</span><strong>{selectedInquiry.job_type || "미입력"}</strong></div>
                      <div className="crm-classic-row"><span>대출상품</span><strong>{selectedInquiry.loan_type || "미입력"}</strong></div>
                      <div className="crm-classic-row"><span>이메일</span><strong>{selectedInquiry.email || "미입력"}</strong></div>
                      <div className="crm-classic-row"><span>등록일자</span><strong>{formatReviewDateTime(selectedInquiry.created_at)}</strong></div>
                      <div className="crm-classic-row crm-classic-row-wide"><span>주소</span><strong>{selectedInquiry.address || [selectedInquiry.city, selectedInquiry.district, selectedInquiry.town, selectedInquiry.apartment].filter(Boolean).join(" ") || "미입력"}</strong></div>
                      <div className="crm-classic-row"><span>선택면적</span><strong>{selectedInquiry.area || "미입력"}</strong></div>
                      <div className="crm-classic-row crm-classic-row-wide"><span>전달사항</span><strong>{selectedInquiry.memo || "전달사항 없음"}</strong></div>
                    </div>
                  </section>
                  <section className="crm-panel crm-classic-panel crm-panel-xl">
                    <div className="crm-panel-banner">처리상태</div>
                    <div className="crm-form-grid crm-form-grid-xl">
                      <div className="field"><label>진행상태</label><select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>{STATUS_OPTIONS.filter((x) => x.value !== "all").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                      <div className="field"><label>자격구분</label><select value={form.job_type} onChange={(e) => setForm((p) => ({ ...p, job_type: e.target.value }))}>{JOB_OPTIONS.map((item) => <option key={item || "empty"} value={item}>{item || "선택안함"}</option>)}</select></div>
                      <div className="field"><label>담당자</label><select value={form.assignee} onChange={(e) => setForm((p) => ({ ...p, assignee: e.target.value }))}>{assigneeOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                      <div className="field"><label>이메일</label><input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="이메일 입력" /></div>
                      <div className="field crm-field-wide"><label>통화내용 요약</label><textarea rows={4} value={form.call_summary} onChange={(e) => setForm((p) => ({ ...p, call_summary: e.target.value }))} /></div>
                      <div className="field crm-field-wide"><label>내부 메모</label><textarea rows={4} value={form.internal_memo} onChange={(e) => setForm((p) => ({ ...p, internal_memo: e.target.value }))} /></div>
                    </div>
                    {saveMessage ? <div className={`api-status ${saveMessage.type}`}>{saveMessage.text}</div> : null}
                    <button type="button" className="primary-btn crm-save-btn" onClick={handleSave} disabled={saving}>{saving ? "저장 중..." : "상담 정보 저장"}</button>
                  </section>
                </div>
                <section className="crm-panel crm-panel-xl">
                  <div className="crm-panel-banner">상담이력</div>
                  <div className="crm-notes-composer">
                    <input value={noteAuthor} onChange={(e) => setNoteAuthor(e.target.value)} placeholder="작성자" />
                    <textarea rows={4} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="상담 진행 내용, 요청사항, 후속조치 등을 기록해주세요." />
                    <button type="button" className="primary-btn" onClick={handleAddNote} disabled={noteSaving}>{noteSaving ? "추가 중..." : "상담 이력 추가"}</button>
                  </div>
                  <div className="crm-note-timeline">
                    {notes.length === 0 ? <div className="crm-empty-state small">등록된 상담 이력이 없습니다.</div> : notes.map((note) => (
                      <article key={note.id} className="crm-note-card">
                        <div className="crm-note-head"><strong>{note.author}</strong><span>{formatReviewDateTime(note.created_at)}</span></div>
                        <p>{note.content}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </section>
            ) : <section className="crm-panel crm-detail-shell"><div className="crm-empty-state">왼쪽에서 고객을 선택하면 상세 정보와 상담 이력이 표시됩니다.</div></section>}
          </div>
        </section>
      </main>
    </div>
  );
}
