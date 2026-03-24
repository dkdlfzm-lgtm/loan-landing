"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatReviewDateTime, maskEmail } from "../lib-reviews";

function InquiryCard({ inquiry, onStatusChange }) {
  return (
    <div className="admin-card-item">
      <div className="admin-card-head">
        <div>
          <strong>{inquiry.name}</strong>
          <div className="admin-card-sub">{inquiry.phone} · {formatReviewDateTime(inquiry.created_at)}</div>
        </div>
        <select value={inquiry.status} onChange={(e) => onStatusChange(inquiry.id, e.target.value)}>
          <option value="new">신규</option>
          <option value="contacted">연락완료</option>
          <option value="closed">처리완료</option>
        </select>
      </div>
      <div className="admin-card-grid">
        <div><span>대출유형</span><strong>{inquiry.loan_type || "-"}</strong></div>
        <div><span>접수위치</span><strong>{inquiry.source_page || "home"}</strong></div>
        <div><span>주소</span><strong>{inquiry.address || [inquiry.city, inquiry.district, inquiry.town, inquiry.apartment].filter(Boolean).join(" ") || "-"}</strong></div>
        <div><span>면적</span><strong>{inquiry.area || "-"}</strong></div>
      </div>
      {inquiry.memo && <div className="admin-card-note">{inquiry.memo}</div>}
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

  const stats = useMemo(() => ({
    inquiryCount: inquiries.length,
    newCount: inquiries.filter((item) => item.status === "new").length,
    reviewCount: reviews.length,
    publishedCount: reviews.filter((item) => item.status === "published").length,
  }), [inquiries, reviews]);

  async function loadDashboard() {
    const [inquiryRes, reviewRes] = await Promise.all([
      fetch("/api/admin/inquiries", { cache: "no-store" }),
      fetch("/api/admin/reviews", { cache: "no-store" }),
    ]);
    const inquiryData = await inquiryRes.json();
    const reviewData = await reviewRes.json();
    if (!inquiryRes.ok || inquiryData?.ok === false) throw new Error(inquiryData?.message || "상담접수 목록을 불러오지 못했습니다.");
    if (!reviewRes.ok || reviewData?.ok === false) throw new Error(reviewData?.message || "이용후기 목록을 불러오지 못했습니다.");
    setInquiries(inquiryData.inquiries || []);
    setReviews(reviewData.reviews || []);
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

  const updateInquiryStatus = async (id, status) => {
    setMessage("");
    const response = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (response.ok && data?.ok) {
      setInquiries((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
      setMessage("상담접수 상태를 수정했습니다.");
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
        <header className="header">
          <div className="container header-inner">
            <div className="brand"><div className="brand-icon">대</div><div><div className="brand-title">대출상담 브랜드명</div><div className="brand-sub">관리자 로그인</div></div></div>
            <nav className="nav"><Link href="/">홈</Link><Link href="/reviews">이용후기</Link></nav>
          </div>
        </header>
        <main className="section reviews-main-section">
          <div className="container admin-login-shell">
            <form className="review-write-card" onSubmit={handleLogin}>
              <div className="section-mini">관리자 페이지</div>
              <h1 className="section-title reviews-page-title">관리자 로그인</h1>
              <p className="card-desc">상담접수와 이용후기 데이터를 확인하려면 관리자 비밀번호를 입력하세요.</p>
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
      <header className="header">
        <div className="container header-inner">
          <div className="brand"><div className="brand-icon">대</div><div><div className="brand-title">대출상담 브랜드명</div><div className="brand-sub">관리자 대시보드</div></div></div>
          <nav className="nav"><Link href="/">홈</Link><Link href="/reviews">이용후기</Link><button type="button" className="nav-btn admin-logout-btn" onClick={handleLogout}>로그아웃</button></nav>
        </div>
      </header>

      <main className="section reviews-main-section">
        <div className="container reviews-shell">
          <div className="admin-stats-grid">
            <div className="home-info-box"><h3>상담접수</h3><div className="phone-main">{stats.inquiryCount}</div><div className="phone-sub">전체 접수</div></div>
            <div className="home-info-box"><h3>신규 접수</h3><div className="phone-main">{stats.newCount}</div><div className="phone-sub">확인 필요</div></div>
            <div className="home-info-box"><h3>이용후기</h3><div className="phone-main">{stats.reviewCount}</div><div className="phone-sub">전체 글</div></div>
            <div className="home-info-box"><h3>게시중 후기</h3><div className="phone-main">{stats.publishedCount}</div><div className="phone-sub">홈/게시판 노출</div></div>
          </div>

          {message && <div className="api-status success">{message}</div>}

          <div className="admin-board-grid">
            <section className="white-panel">
              <div className="admin-section-head"><div><div className="section-mini">상담접수</div><h2 className="section-title admin-title">고객 상담접수</h2></div></div>
              <div className="admin-card-list">
                {inquiries.length === 0 && <div className="admin-card-empty">아직 저장된 상담접수가 없습니다.</div>}
                {inquiries.map((inquiry) => <InquiryCard key={inquiry.id} inquiry={inquiry} onStatusChange={updateInquiryStatus} />)}
              </div>
            </section>

            <section className="white-panel">
              <div className="admin-section-head"><div><div className="section-mini">이용후기</div><h2 className="section-title admin-title">이용후기 관리</h2></div></div>
              <div className="admin-card-list">
                {reviews.length === 0 && <div className="admin-card-empty">아직 저장된 이용후기가 없습니다.</div>}
                {reviews.map((review) => <ReviewCard key={review.id} review={review} onStatusChange={updateReviewStatus} />)}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
