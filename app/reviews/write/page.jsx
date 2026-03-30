"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_SITE_SETTINGS } from "../../../lib/site-settings";

export default function ReviewWritePage() {
  const [form, setForm] = useState({ name: "", password: "", title: "", content: "" });
  const [error, setError] = useState("");
  const [savedReviewId, setSavedReviewId] = useState("");
  const [saving, setSaving] = useState(false);
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled && data?.settings) setSiteSettings((prev) => ({ ...prev, ...data.settings }));
      } catch {}
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.password || !form.title || !form.content) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "이용후기를 등록하지 못했습니다.");
      setSavedReviewId(data.review?.id || "");
      setForm({ name: "", password: "", title: "", content: "" });
    } catch (err) {
      setError(err.message || "이용후기를 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const brandName = siteSettings.company_name || DEFAULT_SITE_SETTINGS.company_name;
  const brandSubtitle = siteSettings.company_subtitle || DEFAULT_SITE_SETTINGS.company_subtitle;

  return (
    <div className="site-wrap reviews-page-wrap premium-reviews-wrap">
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand brand-logo-wrap brand-home-link">
            <img src="/andi-logo.jpg" alt={brandName} className="brand-logo" />
            <div className="brand-copy">
              <div className="brand-title">{brandName}</div>
              <div className="brand-sub">{brandSubtitle}</div>
            </div>
          </Link>
          <nav className="nav">
            <Link href="/">홈</Link>
            <Link href="/reviews">이용후기</Link>
          </nav>
        </div>
      </header>

      <main className="section reviews-main-section premium-reviews-main">
        <div className="container reviews-shell premium-reviews-shell">
          <div className="review-write-card premium-write-card">
            <div className="section-mini">이용후기 작성</div>
            <h1 className="section-title reviews-page-title">상담 후기를 남겨주세요</h1>
            <p className="card-desc">남겨주신 후기는 확인 후 이용후기 게시판에 노출됩니다.</p>

            <form className="form-stack" onSubmit={handleSubmit}>
              <div className="two-col compact-two-col">
                <div className="field">
                  <label>이름</label>
                  <input value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="이름 입력" />
                </div>
                <div className="field">
                  <label>비밀번호</label>
                  <input type="password" value={form.password} onChange={(e) => handleChange("password", e.target.value)} placeholder="비밀번호 입력" />
                </div>
              </div>

              <div className="field">
                <label>제목</label>
                <input value={form.title} onChange={(e) => handleChange("title", e.target.value)} placeholder="제목 입력" />
              </div>

              <div className="field">
                <label>내용</label>
                <textarea rows={8} value={form.content} onChange={(e) => handleChange("content", e.target.value)} placeholder="이용후기 내용을 입력해주세요" />
              </div>

              {error && <div className="api-status error">{error}</div>}
              {savedReviewId && <div className="api-status success">이용후기가 등록되었습니다. <Link href={`/reviews/${savedReviewId}`}>방금 작성한 글 보기</Link></div>}

              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? "등록 중..." : "이용후기 등록하기"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
