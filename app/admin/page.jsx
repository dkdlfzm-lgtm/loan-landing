"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatReviewDateTime, maskEmail } from "../lib-reviews";

const ASSIGNEE_OPTIONS = ["미배정", "김희수", "박지훈", "이서연", "김민수"];
const JOB_OPTIONS = ["", "직장인", "사업자", "법인대표", "주부", "프리랜서", "기타"];
const STATUS_OPTIONS = [
  { value: "new", label: "신규" },
  { value: "contacted", label: "재통화예정" },
  { value: "closed", label: "처리완료" },
];

function InquiryTable({ inquiries, selectedId, onSelect }) {
  return (
    <div className="crm-table-wrap">
      <table className="crm-table">
        <thead>
          <tr>
            <th>고객이름</th>
            <th>자격구분</th>
            <th>통화내용</th>
            <th>담당자</th>
            <th>상태</th>
            <th>접수일시</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.length === 0 && (
            <tr>
              <td colSpan={6} className="crm-empty-cell">저장된 상담접수가 없습니다.</td>
            </tr>
          )}
          {inquiries.map((inquiry) => (
            <tr
              key={inquiry.id}
              className={selectedId === inquiry.id ? "is-active" : ""}
              onClick={() => onSelect(inquiry.id)}
            >
              <td>{inquiry.name}</td>
              <td>{inquiry.job_type || "미입력"}</td>
              <td className="crm-ellipsis">{inquiry.call_summary || inquiry.memo || "상담 내용 없음"}</td>
              <td>{inquiry.assignee || "미배정"}</td>
              <td>{STATUS_OPTIONS.find((item) => item.value === inquiry.status)?.label || inquiry.status}</td>
              <td>{formatReviewDateTime(inquiry.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InquiryDetail({ inquiry, form, setForm, onSave, saveMessage, saving }) {
  if (!inquiry) {
    return <div className="crm-empty-panel">왼쪽 목록에서 고객을 선택하면 상세 정보와 처리내용을 관리할 수 있습니다.</div>;
  }

  return (
    <div className="crm-detail-shell">
      <section className="crm-panel">
        <div className="crm-panel-title">고객정보</div>
        <div className="crm-info-grid">
          <div className="crm-info-row"><span>고객명</span><strong>{inquiry.name}</strong></div>
          <div className="crm-info-row"><span>연락처</span><strong>{inquiry.phone}</strong></div>
          <div className="crm-info-row"><span>대출유형</span><strong>{inquiry.loan_type || "-"}</strong></div>
          <div className="crm-info-row"><span>접수경로</span><strong>{inquiry.source_page || "home"}</strong></div>
          <div className="crm-info-row crm-info-row-wide"><span>주소</span><strong>{inquiry.address || [inquiry.city, inquiry.district, inquiry.town, inquiry.apartment].filter(Boolean).join(" ") || "-"}</strong></div>
          <div className="crm-info-row"><span>면적</span><strong>{inquiry.area || "-"}</strong></div>
          <div className="crm-info-row"><span>접수일시</span><strong>{formatReviewDateTime(inquiry.created_at)}</strong></div>
        </div>
      </section>

      <section className="crm-panel">
        <div className="crm-panel-title">처리상태</div>
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
              {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="crm-field">
            <span>이메일</span>
            <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="고객 이메일" />
          </label>

          <label className="crm-field crm-field-wide">
            <span>통화내용</span>
            <textarea rows={4} value={form.call_summary} onChange={(e) => setForm((prev) => ({ ...prev, call_summary: e.target.value }))} placeholder="현재 통화 내용, 상담 결과, 다음 조치 등을 적어주세요." />
          </label>

          <label className="crm-field crm-field-wide">
            <span>관리자 메모</span>
            <textarea rows={5} value={form.internal_memo} onChange={(e) => setForm((prev) => ({ ...prev, internal_memo: e.target.value }))} placeholder="내부 확인용 메모" />
          </label>
        </div>

        {saveMessage && <div className="api-status success">{saveMessage}</div>}

        <div className="crm-action-row">
          <button type="button" className="primary-btn" onClick={onSave} disabled={saving}>
            {saving ? "저장 중..." : "상담 정보 저장하기"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ReviewCard({ review, onStatusChange }) {
  return (
    <div className="admin-card-item">
      <div className="admin-card-head">
        <div>
          <strong>{review.title}</strong>
          <div className="admin-card-sub">{review.name} · {maskEmail(review.email)} · {formatReviewDateTime(review.created_at)}</div>
        </div>
        <select value={review.status} onChange={(e) => onStatusChange(review.id, e.target.value)}>
          <option value="published">게시중</option>
          <option value="hidden">숨김</option>
        </select>
      </div>
      <div className="admin-card-grid">
        <div><span>조회수</span><strong>{review.view_count || 0}</strong></div>
        <div><span>작성자</span><strong>{review.name}</strong></div>
      </div>
      <div className="admin-card-note">{review.content}</div>
    </div>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState([]);
  const [reviews, setReviews] = useState([]);
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

  const stats = useMemo(() => ({
    inquiryCount: inquiries.length,
    newCount: inquiries.filter((item) => item.status === "new").length,
    reviewCount: reviews.length,
    publishedCount: reviews.filter((item) => item.status === "published").length,
  }), [inquiries, reviews]);

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
    const [inquiryRes, reviewRes] = await Promise.all([
      fetch("/api/admin/inquiries", { cache: "no-store" }),
      fetch("/api/admin/reviews", { cache: "no-store" }),
    ]);
    const inquiryData = await inquiryRes.json();
    const reviewData = await reviewRes.json();
    if (!inquiryRes.ok || inquiryData?.ok === false) throw new Error(inquiryData?.message || "상담접수 목록을 불러오지 못했습니다.");
    if (!reviewRes.ok || reviewData?.ok === false) throw new Error(reviewData?.message || "이용후기 목록을 불러오지 못했습니다.");
    const nextInquiries = inquiryData.inquiries || [];
    setInquiries(nextInquiries);
    setReviews(reviewData.reviews || []);
    if (nextInquiries.length && !selectedInquiryId) {
      setSelectedInquiryId(nextInquiries[0].id);
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
    setReviews([]);
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

  const updateReviewStatus = async (id, status) => {
    setMessage("");
    const response = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (response.ok && data?.ok) {
      setReviews((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
      setMessage("이용후기 상태를 수정했습니다.");
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
            <form className="review-write-card" onSubmit={handleLogin}>
              <div className="section-mini">내부 전용</div>
              <h1 className="section-title reviews-page-title">상담 관리 로그인</h1>
              <p className="card-desc">이 페이지는 직원 전용 관리자 페이지입니다. URL을 알고 있는 직원만 접속할 수 있으며 로그인 후에만 데이터를 확인할 수 있습니다.</p>
              <div className="field"><label>관리자 비밀번호</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="관리자 비밀번호 입력" /></div>
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
        <div className="container reviews-shell">
          <div className="admin-stats-grid">
            <div className="home-info-box"><h3>상담접수</h3><div className="phone-main">{stats.inquiryCount}</div><div className="phone-sub">전체 접수</div></div>
            <div className="home-info-box"><h3>신규 접수</h3><div className="phone-main">{stats.newCount}</div><div className="phone-sub">확인 필요</div></div>
            <div className="home-info-box"><h3>이용후기</h3><div className="phone-main">{stats.reviewCount}</div><div className="phone-sub">전체 글</div></div>
            <div className="home-info-box"><h3>게시중 후기</h3><div className="phone-main">{stats.publishedCount}</div><div className="phone-sub">노출 중</div></div>
          </div>

          {message && <div className={`api-status ${message.includes("못") ? "error" : "success"}`}>{message}</div>}

          <section className="white-panel crm-board-panel">
            <div className="admin-section-head">
              <div>
                <div className="section-mini">직원 전용</div>
                <h2 className="section-title admin-title">상담 고객 관리</h2>
              </div>
              <button type="button" className="nav-btn admin-logout-btn" onClick={handleLogout}>로그아웃</button>
            </div>

            <InquiryTable inquiries={inquiries} selectedId={selectedInquiryId} onSelect={setSelectedInquiryId} />
            <InquiryDetail inquiry={selectedInquiry} form={detailForm} setForm={setDetailForm} onSave={saveInquiry} saveMessage="" saving={detailSaving} />
          </section>

          <section className="white-panel">
            <div className="admin-section-head"><div><div className="section-mini">이용후기</div><h2 className="section-title admin-title">이용후기 관리</h2></div></div>
            <div className="admin-card-list">
              {reviews.length === 0 && <div className="admin-card-empty">아직 저장된 이용후기가 없습니다.</div>}
              {reviews.map((review) => <ReviewCard key={review.id} review={review} onStatusChange={updateReviewStatus} />)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
