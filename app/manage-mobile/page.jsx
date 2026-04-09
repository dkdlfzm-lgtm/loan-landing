"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SITE_SETTINGS, cacheSiteSettings, parseBoolean } from "../../lib/site-settings";
import { buildApprovalCaseContent, parseApprovalCase } from "../../lib/approval-case-format";

const MENUS = [
  { key: "brand", label: "기본정보" },
  { key: "hero", label: "메인 배너" },
  { key: "middle", label: "중간 배너" },
  { key: "notice", label: "공지·팝업" },
  { key: "reviews", label: "승인사례 관리" },
];

function ManagerLogin({ password, setPassword, error, onSubmit }) {
  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container admin-login-shell">
          <form className="review-write-card admin-login-card admin-login-card-pro" onSubmit={onSubmit}>
            <div className="section-mini">모바일 관리 페이지</div>
            <h1 className="section-title reviews-page-title">모바일 홈페이지 관리 로그인</h1>
            <p className="card-desc">모바일 전용 랜딩페이지의 브랜드, 배너, 공지, 팝업, 승인사례 노출을 관리하는 전용 페이지입니다.</p>
            <div className="field">
              <label>관리자 비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="관리자 비밀번호 입력" />
            </div>
            {error ? <div className="api-status error">{error}</div> : null}
            <button type="submit" className="primary-btn">로그인</button>
          </form>
        </div>
      </main>
    </div>
  );
}

function ToggleField({ checked, onChange, label, description }) {
  return (
    <label className="setting-toggle-card">
      <div>
        <div className="setting-toggle-title">{label}</div>
        <div className="setting-toggle-desc">{description}</div>
      </div>
      <span className={`switch-pill ${checked ? "on" : ""}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch-pill-track" />
      </span>
    </label>
  );
}

export default function ManageMobilePage() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [siteSettings, setSiteSettings] = useState({ ...DEFAULT_SITE_SETTINGS, scope: "mobile" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewForm, setReviewForm] = useState({ name: "", currentLoan: "", approvalResult: "", status: "published" });
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [activeMenu, setActiveMenu] = useState("brand");
  const settingsScope = "mobile";

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAuthenticated(Boolean(d.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) {
      if (authenticated === false) setLoading(false);
      return;
    }
    fetchSettings();
    fetchReviews();
  }, [authenticated]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/site-settings?scope=${settingsScope}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "모바일 홈페이지 설정을 불러오지 못했습니다.");
      if (data.settings) {
        setSiteSettings({
          ...DEFAULT_SITE_SETTINGS,
          ...data.settings,
          reviews_enabled: parseBoolean(data.settings.reviews_enabled, true),
          notice_enabled: parseBoolean(data.settings.notice_enabled, false),
          popup_enabled: parseBoolean(data.settings.popup_enabled, false),
          middle_banner_enabled: parseBoolean(data.settings.middle_banner_enabled, false),
        });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "모바일 홈페이지 설정을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  async function fetchReviews() {
    setReviewLoading(true);
    try {
      const res = await fetch("/api/admin/reviews", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "이용승인사례 목록을 불러오지 못했습니다.");
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (err) {
      setReviewMessage(err.message || "이용승인사례 목록을 불러오지 못했습니다.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.message || "로그인 실패");
      return;
    }
    setAuthenticated(true);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/site-settings?scope=${settingsScope}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteSettings),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "모바일 홈페이지 설정 저장 실패");
      const nextSettings = { ...siteSettings, ...(data.settings || {}) };
      setSiteSettings(nextSettings);
      cacheSiteSettings(nextSettings, "mobile");
      setLastSavedAt(new Date());
      setMessage({ type: "success", text: "모바일 홈페이지 설정이 저장되었습니다." });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "모바일 홈페이지 설정 저장 실패" });
    } finally {
      setSaving(false);
    }
  }

  async function updateReviewStatus(id, status) {
    setReviewMessage("");
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "승인사례 상태를 수정하지 못했습니다.");
      setReviews((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
      setReviewMessage(status === "published" ? "승인사례를 노출 상태로 변경했습니다." : "승인사례를 숨김 상태로 변경했습니다.");
    } catch (err) {
      setReviewMessage(err.message || "승인사례 상태를 수정하지 못했습니다.");
    }
  }

  function resetReviewForm() {
    setReviewForm({ name: "", currentLoan: "", approvalResult: "", status: "published" });
    setEditingReviewId(null);
  }

  function startEditReview(review) {
    const parsed = parseApprovalCase(review);
    setEditingReviewId(review.id);
    setReviewForm({
      name: String(parsed.customerName || ""),
      currentLoan: String(parsed.currentLoan || ""),
      approvalResult: String(parsed.approvalResult || ""),
      status: review.status === "hidden" ? "hidden" : "published",
    });
    setReviewMessage("");
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    setReviewMessage("");

    const payload = {
      name: String(reviewForm.name || "").trim(),
      title: String(reviewForm.name || "").trim(),
      content: buildApprovalCaseContent(reviewForm.currentLoan, reviewForm.approvalResult),
      status: reviewForm.status === "hidden" ? "hidden" : "published",
    };

    if (!payload.name || !String(reviewForm.currentLoan || "").trim() || !String(reviewForm.approvalResult || "").trim()) {
      setReviewMessage("고객이름, 내용, 승인을 입력해주세요.");
      return;
    }

    setReviewSaving(true);
    try {
      const res = await fetch(editingReviewId ? `/api/admin/reviews/${editingReviewId}` : "/api/admin/reviews", {
        method: editingReviewId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || (editingReviewId ? "승인사례를 수정하지 못했습니다." : "승인사례를 등록하지 못했습니다."));

      if (editingReviewId) {
        setReviews((prev) => prev.map((item) => (item.id === editingReviewId ? { ...item, ...(data.review || {}), ...payload } : item)));
        setReviewMessage("승인사례를 수정했습니다.");
      } else {
        setReviews((prev) => [data.review, ...prev].filter(Boolean));
        setReviewMessage("승인사례를 등록했습니다.");
      }
      resetReviewForm();
    } catch (err) {
      setReviewMessage(err.message || "승인사례 저장에 실패했습니다.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function deleteReview(id) {
    if (!window.confirm("이 승인사례를 삭제하시겠습니까?")) return;
    setReviewSaving(true);
    setReviewMessage("");
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "승인사례를 삭제하지 못했습니다.");
      setReviews((prev) => prev.filter((item) => item.id !== id));
      if (editingReviewId === id) resetReviewForm();
      setReviewMessage("승인사례를 삭제했습니다.");
    } catch (err) {
      setReviewMessage(err.message || "승인사례를 삭제하지 못했습니다.");
    } finally {
      setReviewSaving(false);
    }
  }

  function updateField(key, value) {
    setSiteSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleLogoFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateField("logo_url", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function handleHeroBackgroundFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateField("hero_background_url", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  const heroTitleLines = useMemo(() => String(siteSettings.hero_title || "").split("\n").filter(Boolean), [siteSettings.hero_title]);
  const heroFeatures = [siteSettings.hero_feature_1, siteSettings.hero_feature_2, siteSettings.hero_feature_3].filter((item) => String(item || "").trim());
  const heroStyle = siteSettings.hero_background_url
    ? { backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.84), rgba(30, 41, 59, 0.68)), url(${siteSettings.hero_background_url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  if (authenticated === null) return <div className="site-wrap"><main className="section"><div className="container"><div className="white-panel">불러오는 중...</div></div></main></div>;
  if (!authenticated) return <ManagerLogin password={password} setPassword={setPassword} error={error} onSubmit={handleLogin} />;

  return (
    <div className="site-wrap admin-wrap">
      <main className="section">
        <div className="container manage-shell">
          <aside className="crm-sidebar crm-sidebar-large crm-sidebar-owner">
            <div className="crm-sidebar-brand">
              <div className="crm-sidebar-eyebrow">모바일 관리 페이지</div>
              <strong>모바일 홈페이지 설정 센터</strong>
              <span>모바일 전용 랜딩페이지를 기능별로 나눠 관리합니다.</span>
            </div>
            <nav className="crm-sidebar-nav">
              {MENUS.map((menu) => (
                <button key={menu.key} type="button" className={`crm-sidebar-tab ${activeMenu === menu.key ? "active" : ""}`} onClick={() => setActiveMenu(menu.key)}>
                  {menu.label}
                </button>
              ))}
            </nav>
            <a className="nav-btn crm-ghost-link" href="/m" target="_blank" rel="noreferrer">모바일 미리보기</a>
            <a className="nav-btn crm-ghost-link" href="/manage">PC 홈페이지 관리</a>
            <a className="nav-btn crm-ghost-link" href="/admin">관리자 페이지 열기</a>
            <a className="nav-btn crm-ghost-link" href="/staff">직원 페이지 열기</a>
            <button type="button" className="nav-btn admin-logout-btn crm-sidebar-logout" onClick={handleLogout}>로그아웃</button>
          </aside>

          <section className="crm-main manage-main">
            <div className="white-panel crm-settings-panel manage-header-panel">
              <div className="section-mini">운영용 모바일 홈페이지 관리</div>
              <h1 className="section-title">브랜드/배너/공지/승인사례 설정</h1>
              <p className="card-desc">PC 관리와 분리해서 모바일 전용 문구와 배너를 따로 관리할 수 있습니다.</p>
              {lastSavedAt ? <div className="crm-last-sync">최근 저장: {lastSavedAt.toLocaleString("ko-KR")}</div> : null}
            </div>

            <div className="white-panel crm-settings-panel">
              {loading ? (
                <div className="crm-empty-state">설정을 불러오는 중입니다.</div>
              ) : (
                <form className="form-stack manage-form-stack" onSubmit={handleSave}>
                  {activeMenu === "brand" ? (
                    <>
                      <section className="manage-section-block">
                        <div className="manage-section-head">
                          <div>
                            <div className="section-mini">브랜드 기본정보</div>
                            <h2 className="manage-section-title">회사 정보와 로고</h2>
                          </div>
                        </div>
                        <div className="two-col compact-two-col">
                          <div className="field">
                            <label>회사명</label>
                            <input value={siteSettings.company_name || ""} onChange={(e) => updateField("company_name", e.target.value)} placeholder="회사명 입력" />
                          </div>
                          <div className="field">
                            <label>회사 소개 한줄</label>
                            <input value={siteSettings.company_subtitle || ""} onChange={(e) => updateField("company_subtitle", e.target.value)} placeholder="상단 보조 문구 입력" />
                          </div>
                        </div>
                        <div className="two-col compact-two-col manage-logo-grid">
                          <div className="field">
                            <label>로고 이미지 업로드</label>
                            <input type="file" accept="image/*" onChange={handleLogoFile} />
                            <div className="manage-upload-note">이미지는 업로드 방식으로만 변경됩니다.</div>
                          </div>
                          <div className="field manage-upload-actions">
                            <label>현재 로고 상태</label>
                            <div className="manage-upload-status">{siteSettings.logo_url ? "업로드된 로고가 적용 중입니다." : "기본 로고가 적용 중입니다."}</div>
                            <button type="button" className="secondary-btn manage-clear-btn" onClick={() => updateField("logo_url", DEFAULT_SITE_SETTINGS.logo_url)}>기본 로고로 되돌리기</button>
                          </div>
                        </div>
                        <div className="manage-logo-preview-card">
                          <div className="manage-logo-preview-head">로고 미리보기</div>
                          <div className="manage-logo-preview brand-logo-wrap">
                            <img src={siteSettings.logo_url || DEFAULT_SITE_SETTINGS.logo_url} alt={siteSettings.company_name || "로고"} className="brand-logo" />
                            <div className="brand-copy">
                              <div className="brand-title">{siteSettings.company_name || DEFAULT_SITE_SETTINGS.company_name}</div>
                              <div className="brand-sub">{siteSettings.company_subtitle || DEFAULT_SITE_SETTINGS.company_subtitle}</div>
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="manage-section-block">
                        <div className="manage-section-head">
                          <div>
                            <div className="section-mini">연락처 설정</div>
                            <h2 className="manage-section-title">상담 채널 정보</h2>
                          </div>
                        </div>
                        <div className="two-col compact-two-col">
                          <div className="field">
                            <label>대표번호</label>
                            <input value={siteSettings.phone || ""} onChange={(e) => updateField("phone", e.target.value)} placeholder="070-0000-0000" />
                          </div>
                          <div className="field">
                            <label>카카오톡 ID</label>
                            <input value={siteSettings.kakao_id || ""} onChange={(e) => updateField("kakao_id", e.target.value)} placeholder="카카오톡 ID 입력" />
                          </div>
                        </div>
                        <div className="field">
                          <label>카카오 오픈채팅 링크</label>
                          <input value={siteSettings.kakao_url || ""} onChange={(e) => updateField("kakao_url", e.target.value)} placeholder="https://open.kakao.com/..." />
                        </div>
                      </section>
                    </>
                  ) : null}

                  {activeMenu === "hero" ? (
                    <section className="manage-section-block">
                      <div className="manage-section-head">
                        <div>
                          <div className="section-mini">메인 배너 설정</div>
                          <h2 className="manage-section-title">첫 화면 문구와 배경</h2>
                        </div>
                      </div>
                      <div className="two-col compact-two-col manage-logo-grid">
                        <div className="field">
                          <label>메인 배경 이미지 업로드</label>
                          <input type="file" accept="image/*" onChange={handleHeroBackgroundFile} />
                          <div className="manage-upload-note">배경 이미지는 업로드 후 바로 미리보기에 반영됩니다.</div>
                        </div>
                        <div className="field manage-upload-actions">
                          <label>현재 배경 상태</label>
                          <div className="manage-upload-status">{siteSettings.hero_background_url ? "업로드된 배경 이미지가 적용 중입니다." : "기본 그라데이션이 적용 중입니다."}</div>
                          <button type="button" className="secondary-btn manage-clear-btn" onClick={() => updateField("hero_background_url", "")}>기본 배경으로 되돌리기</button>
                        </div>
                      </div>
                      <div className="field">
                        <label>메인 배지 문구</label>
                        <input value={siteSettings.hero_badge || ""} onChange={(e) => updateField("hero_badge", e.target.value)} placeholder="상단 배지 문구" />
                      </div>
                      <div className="field">
                        <label>메인 타이틀</label>
                        <textarea rows={4} value={siteSettings.hero_title || ""} onChange={(e) => updateField("hero_title", e.target.value)} placeholder={"줄바꿈으로 문단 구분\n예: 아파트 시세조회부터"} />
                      </div>
                      <div className="field">
                        <label>메인 설명 문구</label>
                        <textarea rows={4} value={siteSettings.hero_description || ""} onChange={(e) => updateField("hero_description", e.target.value)} placeholder="메인 설명 문구 입력" />
                      </div>
                      <div className="three-col crm-settings-grid-cta">
                        <div className="field"><label>배너 포인트 1</label><input value={siteSettings.hero_feature_1 || ""} onChange={(e) => updateField("hero_feature_1", e.target.value)} /></div>
                        <div className="field"><label>배너 포인트 2</label><input value={siteSettings.hero_feature_2 || ""} onChange={(e) => updateField("hero_feature_2", e.target.value)} /></div>
                        <div className="field"><label>배너 포인트 3</label><input value={siteSettings.hero_feature_3 || ""} onChange={(e) => updateField("hero_feature_3", e.target.value)} /></div>
                      </div>
                      <div className="three-col crm-settings-grid-cta">
                        <div className="field"><label>상담 버튼 문구</label><input value={siteSettings.consult_button_text || ""} onChange={(e) => updateField("consult_button_text", e.target.value)} /></div>
                        <div className="field"><label>메인 버튼 1</label><input value={siteSettings.hero_primary_cta || ""} onChange={(e) => updateField("hero_primary_cta", e.target.value)} /></div>
                        <div className="field"><label>메인 버튼 2</label><input value={siteSettings.hero_secondary_cta || ""} onChange={(e) => updateField("hero_secondary_cta", e.target.value)} /></div>
                      </div>
                      <div className="manage-preview-shell">
                        <div className="manage-preview-head">메인 배너 미리보기</div>
                        <div className="manage-hero-preview" style={heroStyle}>
                          <div className="hero-pill">{siteSettings.hero_badge}</div>
                          <div className="manage-hero-title">{heroTitleLines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
                          <p>{siteSettings.hero_description}</p>
                          {heroFeatures.length ? <div className="hero-feature-list">{heroFeatures.map((item) => <span key={item} className="hero-feature-chip">{item}</span>)}</div> : null}
                          <div className="manage-preview-actions">
                            <span className="btn btn-white manage-preview-btn">{siteSettings.hero_primary_cta}</span>
                            <span className="btn btn-outline manage-preview-btn dark-outline">{siteSettings.hero_secondary_cta}</span>
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeMenu === "middle" ? (
                    <section className="manage-section-block">
                      <div className="manage-section-head">
                        <div>
                          <div className="section-mini">중간 안내 배너</div>
                          <h2 className="manage-section-title">메인 중간 배너 섹션</h2>
                        </div>
                      </div>
                      <div className="settings-grid-toggle manage-toggle-single">
                        <ToggleField checked={Boolean(siteSettings.middle_banner_enabled)} onChange={(value) => updateField("middle_banner_enabled", value)} label="중간 배너 노출" description="메인 페이지 시세조회 아래에 강조 배너를 노출합니다." />
                      </div>
                      <div className="two-col compact-two-col">
                        <div className="field"><label>배너 배지</label><input value={siteSettings.middle_banner_badge || ""} onChange={(e) => updateField("middle_banner_badge", e.target.value)} /></div>
                        <div className="field"><label>버튼 문구</label><input value={siteSettings.middle_banner_button_text || ""} onChange={(e) => updateField("middle_banner_button_text", e.target.value)} /></div>
                      </div>
                      <div className="field"><label>배너 제목</label><input value={siteSettings.middle_banner_title || ""} onChange={(e) => updateField("middle_banner_title", e.target.value)} /></div>
                      <div className="field"><label>배너 설명</label><textarea rows={3} value={siteSettings.middle_banner_description || ""} onChange={(e) => updateField("middle_banner_description", e.target.value)} /></div>
                      <div className="field"><label>버튼 링크</label><input value={siteSettings.middle_banner_button_url || ""} onChange={(e) => updateField("middle_banner_button_url", e.target.value)} placeholder="#contact 또는 https://..." /></div>
                    </section>
                  ) : null}

                  {activeMenu === "notice" ? (
                    <section className="manage-section-block">
                      <div className="manage-section-head">
                        <div>
                          <div className="section-mini">공지/팝업 설정</div>
                          <h2 className="manage-section-title">노출 제어</h2>
                        </div>
                      </div>
                      <div className="settings-grid-toggle">
                        <ToggleField checked={Boolean(siteSettings.reviews_enabled)} onChange={(value) => updateField("reviews_enabled", value)} label="승인사례 섹션 노출" description="홈 상단 메뉴와 메인 승인사례 섹션 노출을 켜고 끌 수 있습니다." />
                        <ToggleField checked={Boolean(siteSettings.notice_enabled)} onChange={(value) => updateField("notice_enabled", value)} label="상단 공지 배너" description="홈페이지 상단에 짧은 안내 문구를 띄웁니다." />
                        <ToggleField checked={Boolean(siteSettings.popup_enabled)} onChange={(value) => updateField("popup_enabled", value)} label="메인 팝업 노출" description="좌측 플로팅 팝업으로 노출되며 하루 동안 다시 보지 않기를 지원합니다." />
                      </div>
                      <div className="field"><label>상단 공지 문구</label><input value={siteSettings.notice_text || ""} onChange={(e) => updateField("notice_text", e.target.value)} /></div>
                      <div className="two-col compact-two-col">
                        <div className="field"><label>팝업 제목</label><input value={siteSettings.popup_title || ""} onChange={(e) => updateField("popup_title", e.target.value)} /></div>
                        <div className="field"><label>팝업 버튼 문구</label><input value={siteSettings.popup_button_text || ""} onChange={(e) => updateField("popup_button_text", e.target.value)} /></div>
                      </div>
                      <div className="field"><label>팝업 설명 문구</label><textarea rows={4} value={siteSettings.popup_description || ""} onChange={(e) => updateField("popup_description", e.target.value)} /></div>
                      <div className="field"><label>팝업 버튼 링크</label><input value={siteSettings.popup_button_url || ""} onChange={(e) => updateField("popup_button_url", e.target.value)} placeholder="#contact 또는 https://..." /></div>
                    </section>
                  ) : null}

                  {message ? <div className={`api-status ${message.type === "success" ? "success" : "error"}`}>{message.text}</div> : null}
                  <div className="manage-actions">
                    <button type="button" className="secondary-btn" onClick={fetchSettings} disabled={saving}>다시 불러오기</button>
                    <button type="submit" className="primary-btn" disabled={saving}>{saving ? "저장 중..." : "홈페이지 설정 저장"}</button>
                  </div>
                </form>
              )}
            </div>

            {activeMenu === "reviews" ? (
              <div className="white-panel crm-settings-panel manage-review-panel">
                <div className="manage-section-head">
                  <div>
                    <div className="section-mini">승인사례 운영 관리</div>
                    <h2 className="manage-section-title">승인사례 작성 · 수정 · 삭제</h2>
                  </div>
                  <button type="button" className="secondary-btn" onClick={fetchReviews}>새로고침</button>
                </div>

                {reviewMessage ? <div className={`api-status ${reviewMessage.includes("못") || reviewMessage.includes("입력") ? "error" : "success"}`}>{reviewMessage}</div> : null}

                <form className="form-stack" onSubmit={handleReviewSubmit}>
                  <div className="two-col compact-two-col">
                    <div className="field">
                      <label>고객이름 입력칸</label>
                      <input value={reviewForm.name} onChange={(e) => setReviewForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="예: 김*완님" />
                    </div>
                    <div className="field">
                      <label>노출 상태</label>
                      <select value={reviewForm.status} onChange={(e) => setReviewForm((prev) => ({ ...prev, status: e.target.value }))}>
                        <option value="published">노출</option>
                        <option value="hidden">숨김</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>내용</label>
                    <textarea rows={4} value={reviewForm.currentLoan} onChange={(e) => setReviewForm((prev) => ({ ...prev, currentLoan: e.target.value }))} placeholder="예: 신*은행 3억 2000만원, 피*펀* 1억 3000만원 이용중" />
                  </div>
                  <div className="field">
                    <label>승인</label>
                    <textarea rows={3} value={reviewForm.approvalResult} onChange={(e) => setReviewForm((prev) => ({ ...prev, approvalResult: e.target.value }))} placeholder="예: 새** 4.9억 4.8% 승인" />
                  </div>
                  <div className="manage-actions">
                    <button type="button" className="secondary-btn" onClick={resetReviewForm} disabled={reviewSaving}>새 글 작성</button>
                    <button type="submit" className="primary-btn" disabled={reviewSaving}>{reviewSaving ? "저장 중..." : editingReviewId ? "승인사례 수정" : "승인사례 등록"}</button>
                  </div>
                </form>

                {reviewLoading ? <div className="crm-empty-state">승인사례 목록을 불러오는 중입니다.</div> : null}
                {!reviewLoading ? (
                  <div className="manage-review-list">
                    {reviews.length === 0 ? <div className="crm-empty-state">등록된 승인사례가 없습니다.</div> : reviews.map((review) => {
                      const parsed = parseApprovalCase(review);
                      return (
                      <div key={review.id} className="manage-review-item">
                        <div className="manage-review-copy">
                          <div className="manage-review-topline">
                            <strong>{parsed.customerName || review.title}</strong>
                            <span className={`status-chip ${review.status === "published" ? "status-approved" : "status-hold"}`}>{review.status === "published" ? "노출중" : "숨김"}</span>
                          </div>
                          <div className="manage-review-meta">{String(review.created_at || "").slice(0, 10)} · 조회수 {Number(review.view_count || 0)}</div>
                          <p>{parsed.currentLoan}</p>
                          <p style={{ fontWeight: 700, color: '#2457d6' }}>{parsed.approvalResult}</p>
                        </div>
                        <div className="manage-review-actions">
                          <button type="button" className="secondary-btn" onClick={() => startEditReview(review)} disabled={reviewSaving}>수정</button>
                          <button type="button" className="secondary-btn" onClick={() => updateReviewStatus(review.id, review.status === "published" ? "hidden" : "published")} disabled={reviewSaving}>{review.status === "published" ? "숨김" : "노출"}</button>
                          <button type="button" className="admin-delete-btn" onClick={() => deleteReview(review.id)} disabled={reviewSaving}>삭제</button>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
