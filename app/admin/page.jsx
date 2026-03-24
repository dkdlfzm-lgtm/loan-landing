"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReviewDateTime } from "../lib-reviews";

const ASSIGNEE_OPTIONS = ["미배정", "김희수", "박지훈", "이서연", "김민수"];
const JOB_OPTIONS = ["", "직장인", "사업자", "법인대표", "주부", "프리랜서", "기타"];
const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "new", label: "신규" },
  { value: "contacted", label: "재통화예정" },
  { value: "closed", label: "처리완료" },
];

function statusLabel(value) {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value || "미정";
}

function SummaryCard({ title, value, desc }) {
  return (
    <div className="crm-summary-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{desc}</small>
    </div>
  );
}

function InquiryTable({ inquiries, selectedId, onSelect }) {
  return (
    <div className="crm-table-wrap crm-table-modern-wrap">
      <table className="crm-table crm-table-modern">
        <thead>
          <tr>
            <th>고객이름</th>
            <th>자격구분</th>
            <th>대출유형</th>
            <th>통화내용</th>
            <th>담당자</th>
            <th>상태</th>
            <th>접수일시</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.length === 0 && (
            <tr>
              <td colSpan={7} className="crm-empty-cell">조건에 맞는 상담 접수가 없습니다.</td>
            </tr>
          )}
          {inquiries.map((item) => (
            <tr
              key={item.id}
              className={selectedId === item.id ? "is-active" : ""}
              onClick={() => onSelect(item.id)}
            >
              <td>
                <div className="crm-customer-cell">
                  <strong>{item.name}</strong>
                  <span>{item.phone}</span>
                </div>
              </td>
              <td>{item.job_type || "미입력"}</td>
              <td>{item.loan_type || "미입력"}</td>
              <td className="crm-ellipsis">{item.call_summary || item.memo || "통화 내용 없음"}</td>
              <td>{item.assignee || "미배정"}</td>
              <td><span className={`crm-status-chip crm-status-${item.status || "new"}`}>{statusLabel(item.status)}</span></td>
              <td>{formatReviewDateTime(item.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InquiryDetail({ inquiry, form, setForm, onSave, saving, message }) {
  if (!inquiry) {
    return <div className="crm-empty-panel">왼쪽 목록에서 고객을 선택하면 상세 정보와 처리 내용을 확인할 수 있습니다.</div>;
  }

  const fullAddress = inquiry.address || [inquiry.city, inquiry.district, inquiry.town, inquiry.apartment].filter(Boolean).join(" ");

  return (
    <div className="crm-detail-shell crm-detail-shell-modern">
      <section className="crm-panel crm-panel-elevated">
        <div className="crm-panel-title">고객 기본 정보</div>
        <div className="crm-info-grid">
          <div className="crm-info-row"><span>고객명</span><strong>{inquiry.name}</strong></div>
          <div className="crm-info-row"><span>연락처</span><strong>{inquiry.phone}</strong></div>
          <div className="crm-info-row"><span>자격구분</span><strong>{inquiry.job_type || "미입력"}</strong></div>
          <div className="crm-info-row"><span>대출유형</span><strong>{inquiry.loan_type || "미입력"}</strong></div>
          <div className="crm-info-row"><span>이메일</span><strong>{inquiry.email || "미입력"}</strong></div>
          <div className="crm-info-row"><span>담당자</span><strong>{inquiry.assignee || "미배정"}</strong></div>
          <div className="crm-info-row crm-info-row-wide"><span>주소</span><strong>{fullAddress || "미입력"}</strong></div>
          <div className="crm-info-row"><span>접수경로</span><strong>{inquiry.source_page || "home"}</strong></div>
          <div className="crm-info-row"><span>접수일시</span><strong>{formatReviewDateTime(inquiry.created_at)}</strong></div>
          <div className="crm-info-row"><span>면적</span><strong>{inquiry.area || "미입력"}</strong></div>
          <div className="crm-info-row"><span>상태</span><strong>{statusLabel(inquiry.status)}</strong></div>
          <div className="crm-info-row crm-info-row-wide"><span>접수메모</span><strong>{inquiry.memo || "고객이 남긴 추가 메모 없음"}</strong></div>
        </div>
      </section>

      <section className="crm-panel crm-panel-elevated">
        <div className="crm-panel-title">상담 관리</div>
        <div className="crm-form-grid">
          <label className="crm-field">
            <span>자격구분</span>
            <select value={form.job_type} onChange={(e) => setForm((prev) => ({ ...prev, job_type: e.target.value }))}>
              {JOB_OPTIONS.map((item) => <option key={item || "blank"} value={item}>{item || "선택"}</option>)}
            </select>
          </label>

          <label className="crm-field">
            <span>담당자</span>
            <select value={form.assignee} onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value }))}>
              {ASSIGNEE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="crm-field">
            <span>처리상태</span>
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
              {STATUS_OPTIONS.filter((item) => item.value !== "all").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="crm-field">
            <span>이메일</span>
            <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="고객 이메일" />
          </label>

          <label className="crm-field crm-field-wide">
            <span>통화내용</span>
            <textarea rows={5} value={form.call_summary} onChange={(e) => setForm((prev) => ({ ...prev, call_summary: e.target.value }))} placeholder="통화 내용, 다음 연락 일정, 준비 서류 등을 입력하세요." />
          </label>

          <label className="crm-field crm-field-wide">
            <span>내부 메모</span>
            <textarea rows={5} value={form.internal_memo} onChange={(e) => setForm((prev) => ({ ...prev, internal_memo: e.target.value }))} placeholder="내부 공유용 메모를 입력하세요." />
          </label>
        </div>

        {message && <div className={`api-status ${message.includes("못") ? "error" : "success"}`}>{message}</div>}

        <div className="crm-action-row">
          <button type="button" className="primary-btn" onClick={onSave} disabled={saving}>
            {saving ? "저장 중..." : "상담 정보 저장하기"}
          </button>
        </div>
      </section>
    </div>
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
  const [detailForm, setDetailForm] = useState({
    job_type: "",
    assignee: "미배정",
    status: "new",
    call_summary: "",
    internal_memo: "",
    email: "",
  });
  const [detailSaving, setDetailSaving] = useState(false);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((item) => {
      const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
      const keyword = search.trim().toLowerCase();
      const source = [item.name, item.phone, item.loan_type, item.assignee, item.call_summary, item.memo]
        .join(" ")
        .toLowerCase();
      const matchesSearch = keyword ? source.includes(keyword) : true;
      return matchesStatus && matchesSearch;
    });
  }, [inquiries, search, statusFilter]);

  const stats = useMemo(() => ({
    total: inquiries.length,
    newCount: inquiries.filter((item) => item.status === "new").length,
    contactedCount: inquiries.filter((item) => item.status === "contacted").length,
    closedCount: inquiries.filter((item) => item.status === "closed").length,
  }), [inquiries]);

  const selectedInquiry = useMemo(
    () => inquiries.find((item) => item.id === selectedInquiryId) || null,
    [inquiries, selectedInquiryId]
  );

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
      setInquiries((prev) => prev.map((item) => item.id === selectedInquiryId ? { ...item, ...detailForm } : item));
      setMessage("상담 정보가 저장되었습니다.");
    } catch (error) {
      setMessage(error.message || "상담 정보를 저장하지 못했습니다.");
    } finally {
      setDetailSaving(false);
    }
  };

  if (loading) {
    return <div className="site-wrap"><main className="section"><div className="container"><div className="white-panel">관리자 페이지를 준비하는 중입니다.</div></div></main></div>;
  }

  if (!authenticated) {
    return (
      <div className="site-wrap admin-wrap">
        <main className="section reviews-main-section">
          <div className="container admin-login-shell">
            <form className="review-write-card admin-login-card" onSubmit={handleLogin}>
              <div className="section-mini">직원 전용 CRM</div>
              <h1 className="section-title reviews-page-title">상담 관리 로그인</h1>
              <p className="card-desc">이 페이지는 직원 전용 상담 관리 페이지입니다. 관리자 비밀번호를 입력한 뒤에만 고객 접수 정보와 처리 내용을 확인할 수 있습니다.</p>
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

  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container reviews-shell crm-dashboard-shell">
          <div className="crm-topbar">
            <div>
              <div className="section-mini">직원 전용 CRM</div>
              <h1 className="section-title admin-title">고객 상담 관리</h1>
              <p className="card-desc crm-top-desc">홈페이지에서 접수된 고객 정보를 확인하고, 상담 진행 내용과 담당자 배정을 관리하세요.</p>
            </div>
            <button type="button" className="nav-btn admin-logout-btn" onClick={handleLogout}>로그아웃</button>
          </div>

          <div className="crm-summary-grid">
            <SummaryCard title="전체 접수" value={stats.total} desc="누적 상담 건수" />
            <SummaryCard title="신규 접수" value={stats.newCount} desc="즉시 확인 필요" />
            <SummaryCard title="재통화예정" value={stats.contactedCount} desc="후속 상담 관리" />
            <SummaryCard title="처리완료" value={stats.closedCount} desc="상담 종료 건" />
          </div>

          <section className="white-panel crm-board-panel crm-board-modern">
            <div className="crm-toolbar">
              <div className="crm-toolbar-left">
                <input
                  className="crm-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="고객명, 연락처, 대출유형, 담당자 검색"
                />
              </div>
              <div className="crm-filter-group">
                {STATUS_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`crm-filter-chip ${statusFilter === item.value ? "active" : ""}`}
                    onClick={() => setStatusFilter(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <InquiryTable inquiries={filteredInquiries} selectedId={selectedInquiryId} onSelect={setSelectedInquiryId} />
            <InquiryDetail inquiry={selectedInquiry} form={detailForm} setForm={setDetailForm} onSave={saveInquiry} saving={detailSaving} message={message} />
          </section>
        </div>
      </main>
    </div>
  );
}
