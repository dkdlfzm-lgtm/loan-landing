"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatReviewDateTime, maskEmail } from "../../lib-reviews";

export default function ReviewDetailPage({ params }) {
  const reviewId = decodeURIComponent(params.id);
  const [review, setReview] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentForm, setCommentForm] = useState({ name: "", content: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentSaving, setCommentSaving] = useState(false);

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
          setComments(data.comments || []);
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

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentForm.name || !commentForm.content) {
      setError("댓글 작성자와 내용을 입력해주세요.");
      return;
    }

    setCommentSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/reviews/${reviewId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commentForm),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "댓글을 등록하지 못했습니다.");
      setComments((prev) => [...prev, data.comment]);
      setCommentForm({ name: "", content: "" });
    } catch (err) {
      setError(err.message || "댓글을 등록하지 못했습니다.");
    } finally {
      setCommentSaving(false);
    }
  };

  if (loading) {
    return <div className="site-wrap reviews-page-wrap"><main className="section reviews-main-section"><div className="container reviews-shell"><div className="white-panel">후기를 불러오는 중입니다.</div></div></main></div>;
  }
  if (!review) {
    return <div className="site-wrap reviews-page-wrap"><main className="section reviews-main-section"><div className="container reviews-shell"><div className="white-panel">후기를 찾을 수 없습니다.</div></div></main></div>;
  }

  return (
    <div className="site-wrap reviews-page-wrap">
      <header className="header">
        <div className="container header-inner">
          <div className="brand">
            <div className="brand-icon">대</div>
            <div>
              <div className="brand-title">대출상담 브랜드명</div>
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

      <main className="section reviews-main-section">
        <div className="container reviews-shell">
          {error && <div className="api-status error">{error}</div>}

          <div className="review-detail-card">
            <div className="review-detail-top">
              <div>
                <div className="section-mini">이용후기 상세</div>
                <h1 className="review-detail-title">{review.title}</h1>
              </div>
              <Link href="/reviews" className="white-pill-btn review-back-link">목록으로</Link>
            </div>

            <div className="review-detail-meta">
              <span>작성자 {review.name}</span>
              <span>이메일 {maskEmail(review.email)}</span>
              <span>조회수 {Number(review.views || 0)}</span>
              <span>작성일 {formatReviewDateTime(review.createdAt)}</span>
            </div>

            <div className="review-detail-content">{review.content}</div>
          </div>

          <div className="review-comment-card">
            <div className="section-mini">댓글</div>
            <h2 className="review-comment-title">댓글 {comments.length}개</h2>

            <div className="review-comment-list">
              {comments.length === 0 && <div className="review-comment-empty">아직 등록된 댓글이 없습니다.</div>}
              {comments.map((comment) => (
                <div key={comment.id} className="review-comment-item">
                  <div className="review-comment-head">
                    <strong>{comment.name}</strong>
                    <span>{formatReviewDateTime(comment.created_at)}</span>
                  </div>
                  <p>{comment.content}</p>
                </div>
              ))}
            </div>

            <form className="form-stack" onSubmit={handleCommentSubmit}>
              <div className="field">
                <label>댓글 작성자</label>
                <input value={commentForm.name} onChange={(e) => setCommentForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="이름 입력" />
              </div>
              <div className="field">
                <label>댓글 내용</label>
                <textarea rows={4} value={commentForm.content} onChange={(e) => setCommentForm((prev) => ({ ...prev, content: e.target.value }))} placeholder="댓글 내용을 입력해주세요" />
              </div>
              <button type="submit" className="primary-btn" disabled={commentSaving}>{commentSaving ? "댓글 등록 중..." : "댓글 등록하기"}</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
