"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReviewDateTime } from "../lib-reviews";

const ASSIGNEE_OPTIONS = ["미배정", "김희수", "박지훈", "이서연", "김민수"];
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

function SummaryCard({ title, value, tone }) {
  return (
    <div className={`crm-summary-card crm-tone-${tone || "default"}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LoginView({ password, setPassword, loginError, handleLogin }) {
  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container admin-login-shell">
          <form className="review-write-card admin-login-card admin-login-card-pro" onSubmit={handleLogin}>
            <div className="section-mini">직원 전용 CRM</div>
            <h1 className="section-title reviews-page-title">상담 관리 로그인</h1>
            <p className="card-desc">
              고객 접수 현황과 상담 이력을 확인하는 내부 전용 페이지입니다. 직원용 비밀번호를 입력한 뒤 접속해주세요.
            </p>
            <div className="field">
              <label>관리자 비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="관리자 비밀번호 입력" />
            </div>
            {loginError && <div className="api-status error">{loginError}</div>}
            <button type="submit" className="primary-btn">로그인</button>
          </form>
        </div>
      </main>
    </div>
  );
}

function InquiryList({ inquiries, selectedId, onSelect }) {
  return (
    <div className="crm-list-card">
      <div className="crm-section-header"><h3>접수 목록</h3><span>고객이름 / 자격구분 / 통화내용 / 담당자</span></div>
      <div className="crm-table-wrap crm-table-modern-wrap crm-list-wrap">
        <table className="crm-table crm-table-modern crm-table-compact">
          <thead>
            <tr>
              <th>고객이름</th>
              <th>자격구분</th>
              <th>통화내용</th>
              <th>담당자</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.length === 0 && (
              <tr>
                <td colSpan={5} className="crm-empty-cell">표시할 접수 내역이 없습니다.</td>
              </tr>
            )}
            {inquiries.map((item) => (
              <tr key={item.id} className={selectedId === item.id ? "is-active" : ""} onClick={() => onSelect(item.id)}>
                <td>
                  <div className="crm-customer-cell">
                    <strong>{item.name}</strong>
                    <span>{item.phone}</span>
                  </div>
                </td>
                <td>{item.job_type || "미입력"}</td>
                <td className="crm-ellipsis">{item.call_summary || item.memo || "상담 내용 없음"}</td>
                <td>{item.assignee || "미배정"}</td>
                <td><span className={`crm-status-chip crm-status-${item.status || "new"}`}>{statusLabel(item.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerInfoSection({ inquiry }) {
  const fullAddress = inquiry.address || [inquiry.city, inquiry.district, inquiry.town, inquiry.apartment].filter(Boolean).join(" ");
  return (
    <section className="crm-panel crm-classic-panel">
      <div className="crm-panel-banner">고객정보</div>
      <div className="crm-classic-grid">
        <div className="crm-classic-row"><span>고객명</span><strong>{inquiry.name}</strong></div>
        <div className="crm-classic-row"><span>연락처</span><strong>{inquiry.phone}</strong></div>
        <div className="crm-classic-row"><span>자격구분</span><strong>{inquiry.job_type || "미입력"}</strong></div>
        <div className="crm-classic-row"><span>대출유형</span><strong>{inquiry.loan_type || "미입력"}</strong></div>
        <div className="crm-classic-row"><span>이메일</span><strong>{inquiry.email || "미입력"}</strong></div>
        <div className="crm-classic-row"><span>등록일자</span><strong>{formatReviewDateTime(inquiry.created_at)}</strong></div>
        <div className="crm-classic-row crm-classic-row-wide"><span>주소</span><strong>{fullAddress || "미입력"}</strong></div>
        <div className="crm-classic-row"><span>선택면적</span><strong>{inquiry.area || "미입력"}</strong></div>
        <div className="crm-classic-row crm-classic-row-wide"><span>전달사항</span><strong>{inquiry.memo || "전달사항 없음"}</strong></div>
      </div>
    </section>
  );
}

function ProcessSection({ inquiry, form, setForm, onSave, saving, message }) {
  return (
    <section className="crm-panel crm-classic-panel">
      <div className="crm-panel-banner">처리상태</div>
      <div className="crm-classic-grid">
        <div className="crm-classic-row"><span>현재상태</span><strong className={`crm-status-text crm-status-${inquiry.status || "new"}`}>{statusLabel(inquiry.status)}</strong></div>
        <div className="crm-classic-row"><span>접수일시</span><strong>{formatReviewDateTime(inquiry.created_at)}</strong></div>
        <div className="crm-classic-row"><span>최근수정</span><strong>{formatReviewDateTime(inquiry.updated_at || inquiry.created_at)}</strong></div>
        <div className="crm-classic-row"><span>담당자</span>
          <select value={form.assignee} onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value }))}>
            {ASSIGNEE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="crm-classic-row"><span>자격구분</span>
          <select value={form.job_type} onChange={(e) => setForm((prev) => ({ ...prev, job_type: e.target.value }))}>
            {JOB_OPTIONS.map((item) => <option key={item || "blank"} value={item}>{item || "선택"}</option>)}
          </select>
        </div>
        <div className="crm-classic-row"><span>처리상태</span>
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
            {STATUS_OPTIONS.filter((item) => item.value !== "all").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="crm-classic-row crm-classic-row-wide"><span>통화요약</span>
          <textarea rows={3} value={form.call_summary} onChange={(e) => setForm((prev) => ({ ...prev, call_summary: e.target.value }))} placeholder="최근 통화 요약을 입력하세요." />
        </div>
        <div className="crm-classic-row crm-classic-row-wide"><span>내부메모</span>
          <textarea rows={4} value={form.internal_memo} onChange={(e) => setForm((prev) => ({ ...prev, internal_memo: e.target.value }))} placeholder="다음 담당자가 참고할 내용을 입력하세요." />
        </div>
      </div>
      {message && <div className={`api-status ${message.includes("못") ? "error" : "success"}`}>{message}</div>}
      <div className="crm-action-row">
        <button type="button" className="primary-btn" onClick={onSave} disabled={saving}>{saving ? "저장 중..." : "처리내용 저장"}</button>
      </div>
    </section>
  );
}

function NotesSection({ notes, noteAuthor, setNoteAuthor, noteContent, setNoteContent, adding, addMessage, onAdd }) {
  return (
    <section className="crm-panel crm-classic-panel">
      <div className="crm-panel-banner">상담이력</div>
      <div className="crm-note-editor">
        <input value={noteAuthor} onChange={(e) => setNoteAuthor(e.target.value)} placeholder="작성자" />
        <textarea rows={4} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="통화 내용, 안내 사항, 다음 진행 내용을 입력하세요." />
        <div className="crm-action-row"><button type="button" className="primary-btn" onClick={onAdd} disabled={adding}>{adding ? "추가 중..." : "상담 이력 추가"}</button></div>
        {addMessage && <div className={`api-status ${addMessage.includes("못") || addMessage.includes("입력") ? "error" : "success"}`}>{addMessage}</div>}
      </div>
      <div className="crm-table-wrap crm-history-wrap">
        <table className="crm-table crm-history-table">
          <thead>
            <tr>
              <th>작성자</th>
              <th>내용</th>
              <th>작성일시</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 && (
              <tr>
                <td colSpan={3} className="crm-empty-cell">등록된 상담 이력이 없습니다.</td>
              </tr>
            )}
            {notes.map((note) => (
              <tr key={note.id}>
                <td>{note.author}</td>
                <td className="crm-history-content">{note.content}</td>
                <td>{formatReviewDateTime(note.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [selectedInquiryId, setSelectedInquiryId] = useState("");
  const [detailForm, setDetailForm] = useState({ job_type: "", assignee: "미배정", status: "new", call_summary: "", internal_memo: "", email: "" });
  const [detailSaving, setDetailSaving] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteAuthor, setNoteAuthor] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");

  const filteredInquiries = useMemo(() => inquiries.filter((item) => {
    const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
    const keyword = search.trim().toLowerCase();
    const source = [item.name, item.phone, item.job_type, item.loan_type, item.assignee, item.call_summary, item.memo].join(" ").toLowerCase();
    const matchesSearch = keyword ? source.includes(keyword) : true;
    return matchesStatus && matchesSearch;
  }), [inquiries, search, statusFilter]);

  const stats = useMemo(() => ({
    total: inquiries.length,
    newCount: inquiries.filter((item) => item.status === "new").length,
    contactedCount: inquiries.filter((item) => item.status === "contacted").length,
    closedCount: inquiries.filter((item) => item.status === "closed").length,
  }), [inquiries]);

  const selectedInquiry = useMemo(() => inquiries.find((item) => item.id === selectedInquiryId) || null, [inquiries, selectedInquiryId]);

  useEffect(() => {
    if (!selectedInquiry) return;
    setDetailForm({
      job_type: selectedInquiry.job_type || "",
      assignee: selectedInquiry.assignee || "미배정",
      status: selectedInquiry.status || "new",
      call_summary: selectedInquiry.call_summary || "",
      internal_memo: selectedInquiry.internal_memo || "",
      email: selectedInquiry.email || "",
    });
    setNoteAuthor(selectedInquiry.assignee && selectedInquiry.assignee !== "미배정" ? selectedInquiry.assignee : "");
  }, [selectedInquiry]);

  async function loadDashboard() {
    const response = await fetch("/api/admin/inquiries", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data?.ok === false) throw new Error(data?.message || "상담접수 목록을 불러오지 못했습니다.");
    const nextInquiries = data.inquiries || [];
    setInquiries(nextInquiries);
    if (nextInquiries.length) {
      setSelectedInquiryId((prev) => (prev && nextInquiries.some((item) => item.id === prev) ? prev : nextInquiries[0].id));
    }
  }

  async function loadNotes(inquiryId) {
    if (!inquiryId) {
      setNotes([]);
      return;
    }
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/notes`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "상담 이력을 불러오지 못했습니다.");
      setNotes(data.notes || []);
    } catch {
      setNotes([]);
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    loadNotes(selectedInquiryId);
  }, [authenticated, selectedInquiryId]);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled) {
          setAuthenticated(Boolean(data?.authenticated));
          if (data?.authenticated) await loadDashboard();
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    checkSession();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "로그인에 실패했습니다.");
      setAuthenticated(true);
      setPassword("");
      await loadDashboard();
    } catch (error) {
      setLoginError(error.message || "로그인에 실패했습니다.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setInquiries([]);
    setSelectedInquiryId("");
    setNotes([]);
  };

  const saveInquiry = async () => {
    if (!selectedInquiryId) return;
    setMessage("");
    setDetailSaving(true);
    try {
      const response = await fetch(`/api/admin/inquiries/${selectedInquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detailForm),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "상담 정보를 저장하지 못했습니다.");
      setInquiries((prev) => prev.map((item) => item.id === selectedInquiryId ? { ...item, ...detailForm, updated_at: new Date().toISOString() } : item));
      setMessage("상담 정보가 저장되었습니다.");
    } catch (error) {
      setMessage(error.message || "상담 정보를 저장하지 못했습니다.");
    } finally {
      setDetailSaving(false);
    }
  };

  const addNote = async () => {
    if (!selectedInquiryId) return;
    setNoteMessage("");
    setNoteSaving(true);
    try {
      const response = await fetch(`/api/admin/inquiries/${selectedInquiryId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: noteAuthor, content: noteContent }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "상담 이력을 저장하지 못했습니다.");
      const inserted = data.note;
      setNotes((prev) => [inserted, ...prev]);
      setInquiries((prev) => prev.map((item) => item.id === selectedInquiryId ? { ...item, call_summary: noteContent, updated_at: inserted?.created_at || new Date().toISOString() } : item));
      setDetailForm((prev) => ({ ...prev, call_summary: noteContent }));
      setNoteContent("");
      setNoteMessage("상담 이력이 추가되었습니다.");
    } catch (error) {
      setNoteMessage(error.message || "상담 이력을 저장하지 못했습니다.");
    } finally {
      setNoteSaving(false);
    }
  };

  if (loading) {
    return <div className="site-wrap"><main className="section"><div className="container"><div className="white-panel">관리자 페이지를 준비하는 중입니다.</div></div></main></div>;
  }

  if (!authenticated) {
    return <LoginView password={password} setPassword={setPassword} loginError={loginError} handleLogin={handleLogin} />;
  }

  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container crm-dashboard-pro">
          <div className="crm-topbar crm-topbar-pro">
            <div>
              <div className="section-mini">직원 전용 CRM</div>
              <h1 className="section-title admin-title">고객 상담 관리</h1>
              <p className="card-desc crm-top-desc">고객정보, 처리상태, 상담이력을 한 화면에서 이어서 관리할 수 있도록 구성한 내부 전용 페이지입니다.</p>
            </div>
            <button type="button" className="nav-btn admin-logout-btn" onClick={handleLogout}>로그아웃</button>
          </div>

          <div className="crm-summary-grid crm-summary-grid-pro">
            <SummaryCard title="전체 접수" value={stats.total} tone="default" />
            <SummaryCard title="신규 접수" value={stats.newCount} tone="new" />
            <SummaryCard title="재통화 예정" value={stats.contactedCount} tone="contacted" />
            <SummaryCard title="처리 완료" value={stats.closedCount} tone="closed" />
          </div>

          <section className="white-panel crm-board-panel crm-board-pro">
            <div className="crm-toolbar crm-toolbar-pro">
              <input className="crm-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명, 연락처, 자격구분, 담당자 검색" />
              <div className="crm-filter-group">
                {STATUS_OPTIONS.map((item) => (
                  <button key={item.value} type="button" className={`crm-filter-chip ${statusFilter === item.value ? "active" : ""}`} onClick={() => setStatusFilter(item.value)}>{item.label}</button>
                ))}
              </div>
            </div>

            <InquiryList inquiries={filteredInquiries} selectedId={selectedInquiryId} onSelect={setSelectedInquiryId} />

            {selectedInquiry ? (
              <div className="crm-detail-stack">
                <CustomerInfoSection inquiry={selectedInquiry} />
                <ProcessSection inquiry={selectedInquiry} form={detailForm} setForm={setDetailForm} onSave={saveInquiry} saving={detailSaving} message={message} />
                <NotesSection notes={notes} noteAuthor={noteAuthor} setNoteAuthor={setNoteAuthor} noteContent={noteContent} setNoteContent={setNoteContent} adding={noteSaving} addMessage={noteMessage} onAdd={addNote} />
              </div>
            ) : (
              <div className="crm-empty-panel">왼쪽 목록에서 고객을 선택하면 상세 정보와 처리 내용을 확인할 수 있습니다.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
