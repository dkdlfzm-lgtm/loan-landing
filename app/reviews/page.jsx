"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatReviewDate } from "../lib-reviews";

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
    return () => { cancelled = true; };
  }, [query]);

  const filteredReviews = useMemo(() => reviews, [reviews]);

  return (
    <div className="site-wrap reviews-page-wrap">
      <header className="header">
        <div className="container header-inner">
          <div className="brand">
            <div className="brand-icon">대</div>
            <div>
              <div className="brand-title">대출상담 브랜드명</div>
              <div className="brand-sub">이용후기 게시판</div>
            </div>
          </div>
          <nav className="nav">
            <Link href="/">홈</Link>
            <Link href="/reviews">이용후기</Link>
            <Link href="/reviews/write" className="nav-btn">작성하기</Link>
            <Link href="/admin">관리자</Link>
          </nav>
        </div>
      </header>

      <main className="section reviews-main-section">
        <div className="container reviews-shell">
          <div className="reviews-topbar">
            <div>
              <div className="section-mini">이용후기</div>
              <h1 className="section-title reviews-page-title">실제 이용후기를 확인해보세요</h1>
            </div>
            <Link href="/reviews/write" className="primary-btn reviews-write-btn">작성하기</Link>
          </div>

          <div className="reviews-search-panel">
            <input
              type="text"
              placeholder="제목이나 내용으로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="reviews-count">총 {filteredReviews.length}건</div>
          </div>

          {error && <div className="api-status error">{error}</div>}

          <div className="reviews-board-head">
            <span className="reviews-col-title">제목</span>
            <span className="reviews-col-meta">조회수</span>
            <span className="reviews-col-meta">작성날짜</span>
          </div>

          <div className="reviews-board-list">
            {loading && <div className="white-panel">이용후기를 불러오는 중입니다.</div>}
            {!loading && filteredReviews.length === 0 && <div className="white-panel">등록된 이용후기가 없습니다.</div>}
            {!loading && filteredReviews.map((review) => (
              <Link key={review.id} href={`/reviews/${review.id}`} className="reviews-board-row">
                <div className="reviews-row-main">
                  <strong>{review.title}</strong>
                  <p>{review.content}</p>
                </div>
                <div className="reviews-row-meta">{Number(review.views || 0)}</div>
                <div className="reviews-row-meta">{formatReviewDate(review.createdAt)}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
