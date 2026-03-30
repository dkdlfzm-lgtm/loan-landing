"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_SITE_SETTINGS, cacheSiteSettings, readCachedSiteSettings } from "../../../lib/site-settings";
import { formatReviewDateTime, maskName } from "../../lib-reviews";

const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function useScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!nodes.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

export default function ReviewDetailPage({ params }) {
  useScrollReveal();
  const reviewId = decodeURIComponent(params.id);
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [siteSettings, setSiteSettings] = useState(() => readCachedSiteSettings());
  
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled && data?.settings) {
          const nextSettings = { ...DEFAULT_SITE_SETTINGS, ...data.settings };
          setSiteSettings(nextSettings);
          cacheSiteSettings(nextSettings);
        }
      } catch {}
    }
    loadSettings();
    return () => { cancelled = true; };
  }, []);

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
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const brandName = siteSettings.company_name || DEFAULT_SITE_SETTINGS.company_name;
  const brandSubtitle = siteSettings.company_subtitle || DEFAULT_SITE_SETTINGS.company_subtitle;
  const logoUrl = siteSettings.logo_url || DEFAULT_SITE_SETTINGS.logo_url;

  if (loading) {
    return <div className="site-wrap reviews-page-wrap"><main className="section reviews-main-section"><div className="container reviews-shell"><div className="white-panel">후기를 불러오는 중입니다.</div></div></main></div>;
  }
  if (!review) {
    return <div className="site-wrap reviews-page-wrap"><main className="section reviews-main-section"><div className="container reviews-shell"><div className="white-panel">후기를 찾을 수 없습니다.</div></div></main></div>;
  }

  return (
    <div className="site-wrap reviews-page-wrap premium-reviews-wrap">
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand brand-logo-wrap brand-home-link">
            <img src={logoUrl || TRANSPARENT_PIXEL} alt={brandName} className="brand-logo" />
            <div className="brand-copy">
              <div className="brand-title">{brandName}</div>
              <div className="brand-sub">{brandSubtitle}</div>
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
          {error && <div className="api-status error">{error}</div>}

          <article className="review-detail-card premium-detail-card" data-reveal>
            <div className="review-detail-top premium-detail-top">
              <div>
                <div className="section-mini">고객 이용후기</div>
                <h1 className="review-detail-title premium-detail-title">{review.title}</h1>
              </div>
              <Link href="/reviews" className="white-pill-btn review-back-link">목록으로</Link>
            </div>

            <div className="review-detail-meta premium-detail-meta">
              <span>작성자 {maskName(review.name)}</span>
              <span>조회수 {Number(review.views || 0)}</span>
              <span>작성일 {formatReviewDateTime(review.createdAt)}</span>
            </div>

            <div className="review-detail-content premium-detail-content">{review.content}</div>
          </article>
        </div>
      </main>
    </div>
  );
}
