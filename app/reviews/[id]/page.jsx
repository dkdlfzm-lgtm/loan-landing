"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatReviewDateTime } from "../../lib-reviews";

function ReviewsHeader() {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand brand-logo-wrap">
          <img src="/andi-logo.jpg" alt="엔드아이에셋대부" className="brand-logo" />
          <div className="brand-copy">
            <div className="brand-title">엔드아이에셋대부</div>
            <div className="brand-sub">이용후기 상세</div>
          </div>
        </div>
        <nav className="nav">
          <Link href="/">홈</Link>
          <Link href="/reviews">이용후기</Link>
          <Link href="/reviews/write" className="nav-btn">작성하기</Link>
        </nav>
      </div>
    </header>
  );
}

export default function ReviewDetailPage({ params }) {
  const reviewId = decodeURIComponent(params.id);
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/reviews/${reviewId}?incrementView=1`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.message || "후기를 불러오지 못했습니다.");
        if (!cancelled) {
          setReview(data.review);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "후기를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reviewId]);

  if (loading) {
    return <div className="site-wrap reviews-page-wrap"><main className="section reviews-main-section"><div className="container reviews-shell"><div className="white-panel">후기를 불러오는 중입니다.</div></div></main></div>;
  }
  if (!review) {
    return <div className="site-wrap reviews-page-wrap"><main className="section reviews-main-section"><div className="container reviews-shell"><div className="white-panel">후기를 찾을 수 없습니다.</div></div></main></div>;
  }

  return (
    <div className="site-wrap reviews-page-wrap">
      <ReviewsHeader />

      <main className="section reviews-main-section">
        <div className="container reviews-shell">
          {error && <div className="api-status error">{error}</div>}

          <div className="review-detail-card">
            <div className="review-detail-top">
              <div>
                <div className="section-mini">이용후기</div>
                <h1 className="review-detail-title">{review.title}</h1>
              </div>
              <Link href="/reviews" className="white-pill-btn review-back-link">목록으로</Link>
            </div>

            <div className="review-detail-meta">
              <span>작성자 {review.name}</span>
              <span>조회수 {Number(review.views || 0)}</span>
              <span>작성일 {formatReviewDateTime(review.createdAt)}</span>
            </div>

            <div className="review-detail-content">{review.content}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
