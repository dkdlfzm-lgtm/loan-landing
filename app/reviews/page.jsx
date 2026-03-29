"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatReviewDate, maskName } from "../lib-reviews";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/reviews?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.message || "이용후기를 불러오지 못했습니다.");
        if (!cancelled) setReviews(data.reviews || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "이용후기를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const filteredReviews = useMemo(() => reviews, [reviews]);

  return (
    <div className="site-wrap reviews-page-wrap premium-reviews-wrap">
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand brand-logo-wrap brand-home-link">
            <img src="/andi-logo.jpg" alt="엔드아이에셋대부" className="brand-logo" />
            <div className="brand-copy">
              <div className="brand-title">엔드아이에셋대부</div>
              <div className="brand-sub">주택담보대출 · 대환대출 · 전세퇴거자금 상담</div>
            </div>
          </Link>
          <nav className="nav">
            <Link href="/">홈</Link>
            <Link href="/reviews">이용후기</Link>
            <Link href="/reviews/write" className="nav-btn">후기 작성</Link>
          </nav>
        </div>
      </header>

      <main className="section reviews-main-section premium-reviews-main">
        <div className="container reviews-shell premium-reviews-shell">
          <section className="reviews-hero-panel">
            <div>
              <div className="section-mini">고객 이용후기</div>
              <h1 className="section-title reviews-page-title">실제 상담 후기를 확인해보세요</h1>
              <p className="reviews-hero-desc">담보대출, 대환대출, 전세퇴거자금 상담을 진행한 고객 후기만 모아 정리했습니다.</p>
            </div>
            <div className="reviews-hero-actions">
              <div className="reviews-summary-chip">총 {filteredReviews.length}건</div>
              <Link href="/reviews/write" className="primary-btn reviews-write-btn">후기 작성하기</Link>
            </div>
          </section>

          <div className="reviews-search-panel premium-reviews-search">
            <input
              type="text"
              placeholder="제목이나 내용으로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {error && <div className="api-status error">{error}</div>}

          <div className="reviews-card-list premium-reviews-card-list">
            {loading && <div className="white-panel">이용후기를 불러오는 중입니다.</div>}
            {!loading && filteredReviews.length === 0 && <div className="white-panel">등록된 이용후기가 없습니다.</div>}
            {!loading && filteredReviews.map((review) => (
              <Link key={review.id} href={`/reviews/${review.id}`} className="premium-review-card">
                <div className="premium-review-card-top">
                  <span className="premium-review-badge">이용후기</span>
                  <span className="premium-review-date">{formatReviewDate(review.createdAt)}</span>
                </div>
                <h2 className="premium-review-title">{review.title}</h2>
                <p className="premium-review-content">{review.content}</p>
                <div className="premium-review-footer">
                  <div className="premium-review-author">{maskName(review.name)}</div>
                  <div className="premium-review-meta">조회수 {Number(review.views || 0)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
