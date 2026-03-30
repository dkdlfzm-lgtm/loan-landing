"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SITE_SETTINGS, parseBoolean } from "../../lib/site-settings";

function ManagerLogin({ password, setPassword, error, onSubmit }) {
  return (
    <div className="site-wrap admin-wrap">
      <main className="section reviews-main-section">
        <div className="container admin-login-shell">
          <form className="review-write-card admin-login-card admin-login-card-pro" onSubmit={onSubmit}>
            <div className="section-mini">관리 페이지</div>
            <h1 className="section-title reviews-page-title">홈페이지 설정 로그인</h1>
            <p className="card-desc">브랜드 정보, 로고, 메인 배너, 후기 노출, 공지 노출을 관리하는 전용 페이지입니다.</p>
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

export default function ManagePage() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);

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
  }, [authenticated]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site-settings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "홈페이지 설정을 불러오지 못했습니다.");
      if (data.settings) {
        setSiteSettings({
          ...DEFAULT_SITE_SETTINGS,
          ...data.settings,
          reviews_enabled: parseBoolean(data.settings.reviews_enabled, true),
          notice_enabled: parseBoolean(data.settings.notice_enabled, false),
          popup_enabled: parseBoolean(data.settings.popup_enabled, false),
        });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "홈페이지 설정을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
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
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteSettings),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "홈페이지 설정 저장 실패");
      setSiteSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
      setLastSavedAt(new Date());
      setMessage({ type: "success", text: "홈페이지 설정이 저장되었습니다." });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "홈페이지 설정 저장 실패" });
    } finally {
      setSaving(false);
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

  const heroTitleLines = useMemo(() => String(siteSettings.hero_title || "").split("\n").filter(Boolean), [siteSettings.hero_title]);
  const heroFeatures = [siteSettings.hero_feature_1, siteSettings.hero_feature_2, siteSettings.hero_feature_3].filter((item) => String(item || "").trim());
  const heroStyle = siteSettings.hero_background_url
    ? { backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.82), rgba(30, 41, 59, 0.66)), url(${siteSettings.hero_background_url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  if (authenticated === null) {
    return <div className="site-wrap"><main className="section"><div className="container"><div className="white-panel">불러오는 중...</div></div></main></div>;
  }

  if (!authenticated) {
    return <ManagerLogin password={password} setPassword={setPassword} error={error} onSubmit={handleLogin} />;
  }

  return (
    <div className="site-wrap admin-wrap">
      <main className="section">
        <div className="container manage-shell">
          <aside className="crm-sidebar crm-sidebar-large crm-sidebar-owner">
            <div className="crm-sidebar-brand">
              <div className="crm-sidebar-eyebrow">관리 페이지</div>
              <strong>홈페이지 설정 센터</strong>
              <span>브랜드 · 배너 · 후기 · 공지 · 팝업 설정</span>
            </div>
            <nav className="crm-sidebar-nav">
              <button type="button" className="crm-sidebar-tab active">홈페이지 설정</button>
            </nav>
            <a className="nav-btn crm-ghost-link" href="/admin">관리자 페이지 열기</a>
            <a className="nav-btn crm-ghost-link" href="/staff">직원 페이지 열기</a>
            <button type="button" className="nav-btn admin-logout-btn crm-sidebar-logout" onClick={handleLogout}>로그아웃</button>
          </aside>

          <section className="crm-main manage-main">
            <div className="white-panel crm-settings-panel manage-header-panel">
              <div className="section-mini">운영용 홈페이지 관리</div>
              <h1 className="section-title">브랜드/배너/후기/공지 설정</h1>
              <p className="card-desc">입력 중 값이 다시 덮어쓰이지 않도록 자동 재불러오기를 막아둔 전용 관리 페이지입니다.</p>
              {lastSavedAt ? <div className="crm-last-sync">최근 저장: {lastSavedAt.toLocaleString("ko-KR")}</div> : null}
            </div>

            <div className="white-panel crm-settings-panel">
              {loading ? (
                <div className="crm-empty-state">설정을 불러오는 중입니다.</div>
              ) : (
                <form className="form-stack manage-form-stack" onSubmit={handleSave}>
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
                        <label>로고 이미지 경로/URL</label>
                        <input value={siteSettings.logo_url || ""} onChange={(e) => updateField("logo_url", e.target.value)} placeholder="/andi-logo.jpg 또는 이미지 URL" />
                        <div className="field-help">공개 이미지 URL이나 public 폴더 경로를 넣을 수 있어요.</div>
                      </div>
                      <div className="field">
                        <label>로고 이미지 업로드</label>
                        <input type="file" accept="image/*" onChange={handleLogoFile} />
                        <div className="field-help">간단한 테스트용 업로드입니다. 운영 시에는 public 폴더 경로 사용이 더 안정적입니다.</div>
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

                  <section className="manage-section-block">
                    <div className="manage-section-head">
                      <div>
                        <div className="section-mini">메인 배너 설정</div>
                        <h2 className="manage-section-title">첫 화면 문구와 배경</h2>
                      </div>
                    </div>
                    <div className="field">
                      <label>메인 배경 이미지 경로/URL</label>
                      <input value={siteSettings.hero_background_url || ""} onChange={(e) => updateField("hero_background_url", e.target.value)} placeholder="비워두면 기본 그라데이션" />
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
                      <div className="field">
                        <label>배너 포인트 1</label>
                        <input value={siteSettings.hero_feature_1 || ""} onChange={(e) => updateField("hero_feature_1", e.target.value)} placeholder="예: 무료 한도 상담" />
                      </div>
                      <div className="field">
                        <label>배너 포인트 2</label>
                        <input value={siteSettings.hero_feature_2 || ""} onChange={(e) => updateField("hero_feature_2", e.target.value)} placeholder="예: 빠른 접수 확인" />
                      </div>
                      <div className="field">
                        <label>배너 포인트 3</label>
                        <input value={siteSettings.hero_feature_3 || ""} onChange={(e) => updateField("hero_feature_3", e.target.value)} placeholder="예: 맞춤 상담 연결" />
                      </div>
                    </div>

                    <div className="three-col crm-settings-grid-cta">
                      <div className="field">
                        <label>상담 버튼 문구</label>
                        <input value={siteSettings.consult_button_text || ""} onChange={(e) => updateField("consult_button_text", e.target.value)} placeholder="상담 신청" />
                      </div>
                      <div className="field">
                        <label>메인 버튼 1</label>
                        <input value={siteSettings.hero_primary_cta || ""} onChange={(e) => updateField("hero_primary_cta", e.target.value)} placeholder="빠른 시세조회" />
                      </div>
                      <div className="field">
                        <label>메인 버튼 2</label>
                        <input value={siteSettings.hero_secondary_cta || ""} onChange={(e) => updateField("hero_secondary_cta", e.target.value)} placeholder="무료 상담 신청" />
                      </div>
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

                  <section className="manage-section-block">
                    <div className="manage-section-head">
                      <div>
                        <div className="section-mini">후기/공지 설정</div>
                        <h2 className="manage-section-title">노출 제어</h2>
                      </div>
                    </div>
                    <div className="settings-grid-toggle">
                      <ToggleField checked={Boolean(siteSettings.reviews_enabled)} onChange={(value) => updateField("reviews_enabled", value)} label="이용후기 노출" description="홈 상단 메뉴와 메인 후기 섹션 노출을 켜고 끌 수 있습니다." />
                      <ToggleField checked={Boolean(siteSettings.notice_enabled)} onChange={(value) => updateField("notice_enabled", value)} label="상단 공지 배너" description="홈페이지 상단에 짧은 안내 문구를 띄웁니다." />
                      <ToggleField checked={Boolean(siteSettings.popup_enabled)} onChange={(value) => updateField("popup_enabled", value)} label="메인 팝업 노출" description="홈 첫 진입 시 안내 팝업을 띄웁니다. 닫으면 현재 브라우저에서만 숨겨집니다." />
                    </div>
                    <div className="field">
                      <label>상단 공지 문구</label>
                      <input value={siteSettings.notice_text || ""} onChange={(e) => updateField("notice_text", e.target.value)} placeholder="상단 안내 문구 입력" />
                    </div>
                    <div className="two-col compact-two-col">
                      <div className="field">
                        <label>팝업 제목</label>
                        <input value={siteSettings.popup_title || ""} onChange={(e) => updateField("popup_title", e.target.value)} placeholder="팝업 제목" />
                      </div>
                      <div className="field">
                        <label>팝업 버튼 문구</label>
                        <input value={siteSettings.popup_button_text || ""} onChange={(e) => updateField("popup_button_text", e.target.value)} placeholder="상담 바로가기" />
                      </div>
                    </div>
                    <div className="field">
                      <label>팝업 설명 문구</label>
                      <textarea rows={4} value={siteSettings.popup_description || ""} onChange={(e) => updateField("popup_description", e.target.value)} placeholder="팝업 설명 문구" />
                    </div>
                    <div className="field">
                      <label>팝업 버튼 링크</label>
                      <input value={siteSettings.popup_button_url || ""} onChange={(e) => updateField("popup_button_url", e.target.value)} placeholder="#contact 또는 https://..." />
                    </div>
                  </section>

                  {message ? <div className={`api-status ${message.type === "success" ? "success" : "error"}`}>{message.text}</div> : null}

                  <div className="manage-actions">
                    <button type="button" className="secondary-btn" onClick={fetchSettings} disabled={saving}>다시 불러오기</button>
                    <button type="submit" className="primary-btn" disabled={saving}>{saving ? "저장 중..." : "홈페이지 설정 저장"}</button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
