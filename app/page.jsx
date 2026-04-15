"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SITE_SETTINGS, cacheSiteSettings, readCachedSiteSettings } from "../lib/site-settings";
import { mapReviewToApprovalCard } from "../lib/approval-case-format";

const statSlides = [
  {
    message: "서울 아파트 전세시장은 56주 연속 상승했습니다.",
    items: [
      { label: "주간 매매지수", nation: "91.7", nationDiff: "+0.09%", seoul: "107.6", seoulDiff: "+0.31%" },
      { label: "주간 전세지수", nation: "92.7", nationDiff: "+0.10%", seoul: "97.3", seoulDiff: "+0.20%" },
      { label: "주간 매매가격", nation: "5.68억", nationDiff: "+0.17%", seoul: "15.54억", seoulDiff: "+0.24%" },
      { label: "주간 전세가격", nation: "3.22억", nationDiff: "+0.14%", seoul: "6.77억", seoulDiff: "+0.16%" },
    ],
  },
  {
    message: "수도권 매매가격은 완만한 흐름을 유지하고 있습니다.",
    items: [
      { label: "주간 매매지수", nation: "92.1", nationDiff: "+0.05%", seoul: "108.2", seoulDiff: "+0.18%" },
      { label: "주간 전세지수", nation: "93.0", nationDiff: "+0.08%", seoul: "97.9", seoulDiff: "+0.14%" },
      { label: "주간 매매가격", nation: "5.72억", nationDiff: "+0.11%", seoul: "15.72억", seoulDiff: "+0.19%" },
      { label: "주간 전세가격", nation: "3.28억", nationDiff: "+0.09%", seoul: "6.83억", seoulDiff: "+0.12%" },
    ],
  },
  {
    message: "아파트 실거래량은 전월 대비 소폭 회복세를 보였습니다.",
    items: [
      { label: "주간 매매지수", nation: "91.9", nationDiff: "+0.07%", seoul: "108.0", seoulDiff: "+0.22%" },
      { label: "주간 전세지수", nation: "92.8", nationDiff: "+0.06%", seoul: "97.7", seoulDiff: "+0.13%" },
      { label: "주간 매매가격", nation: "5.70억", nationDiff: "+0.15%", seoul: "15.61억", seoulDiff: "+0.20%" },
      { label: "주간 전세가격", nation: "3.24억", nationDiff: "+0.11%", seoul: "6.80억", seoulDiff: "+0.15%" },
    ],
  },
];


function useScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach((node, index) => {
      node.style.setProperty("--reveal-delay", `${Math.min(index * 60, 360)}ms`);
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);
}

function startOfTomorrow() {

  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

const repaymentDefaults = {
  "원리금균등": "4.9",
  "원금균등": "5.1",
  "만기일시상환": "5.4",
};

const POPUP_STORAGE_KEY = "landing-promo-hide-until-v6";

const loanTypeOptions = [
  "주택담보대출",
  "전세퇴거자금",
  "경매취하자금",
  "사업자대출",
  "대환대출",
  "매매자금대출",
  "기타",
];


function ensureVisitIdentity(scope = "pc") {
  if (typeof window === "undefined") return null;
  const visitorKey = "landing_visitor_id_v1";
  const sessionKey = `landing_session_id_${scope}_v1`;
  let visitorId = window.localStorage.getItem(visitorKey);
  if (!visitorId) {
    visitorId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(visitorKey, visitorId);
  }
  let sessionId = window.sessionStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(sessionKey, sessionId);
  }
  return { visitorId, sessionId };
}

function trackVisit(scope = "pc", pagePath = "/") {
  if (typeof window === "undefined") return;
  const ids = ensureVisitIdentity(scope);
  if (!ids) return;
  const dedupeKey = `visit_logged_${scope}_${pagePath}`;
  if (window.sessionStorage.getItem(dedupeKey)) return;
  window.sessionStorage.setItem(dedupeKey, "1");

  const payload = JSON.stringify({
    visitor_id: ids.visitorId,
    session_id: ids.sessionId,
    page_path: pagePath,
    scope,
    referrer: document.referrer || "",
  });

  fetch("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => null);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

export default function LoanLandingPage() {
  useScrollReveal();
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [repaymentType, setRepaymentType] = useState("");
  const [loanMonths, setLoanMonths] = useState("");

  const [propertyType, setPropertyType] = useState("아파트");
  const [tradeTypes, setTradeTypes] = useState({ sale: true, jeonse: true, monthly: true });
  const [currentView, setCurrentView] = useState("home");
  const [activeSlide, setActiveSlide] = useState(0);
  const [approvalSlide, setApprovalSlide] = useState(0);
  const [approvalDirection, setApprovalDirection] = useState("next");
  const [approvalAnimating, setApprovalAnimating] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedTown, setSelectedTown] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [apartmentQuery, setApartmentQuery] = useState("");
  const [showApartmentList, setShowApartmentList] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [catalogOptions, setCatalogOptions] = useState({ cities: [], districts: [], towns: [], apartments: [], areas: [] });
  const [catalogSource, setCatalogSource] = useState("");
  const [catalogNote, setCatalogNote] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [marketResult, setMarketResult] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [homeInquiry, setHomeInquiry] = useState({ name: "", phone: "", address: "", loanType: loanTypeOptions[0] });
  const [homeInquiryStatus, setHomeInquiryStatus] = useState("");
  const [homeInquirySaving, setHomeInquirySaving] = useState(false);
  const [resultInquiry, setResultInquiry] = useState({ name: "", phone: "", loanType: loanTypeOptions[0], memo: "" });
  const [resultInquiryStatus, setResultInquiryStatus] = useState("");
  const [resultInquirySaving, setResultInquirySaving] = useState(false);
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    trackVisit("pc", "/");
  }, []);
  const [approvalCases, setApprovalCases] = useState([]);
  const [promoDismissed, setPromoDismissed] = useState(false);
  const [promoReady, setPromoReady] = useState(false);
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);
  const [consultPopupOpen, setConsultPopupOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadApprovalCases() {
      try {
        const res = await fetch('/api/reviews?limit=30', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error();
        const nextCases = Array.isArray(data.reviews)
          ? data.reviews.map(mapReviewToApprovalCard).filter((item) => item.customerName || item.title)
          : [];
        if (!cancelled) {
          setApprovalCases(nextCases);
          setApprovalSlide((prev) => Math.min(prev, Math.max(nextCases.length - 1, 0)));
        }
      } catch {
        if (!cancelled) setApprovalCases([]);
      }
    }
    loadApprovalCases();
    return () => {
      cancelled = true;
    };
  }, []);

  const closePromoForToday = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(POPUP_STORAGE_KEY, String(startOfTomorrow()));
    }
    setPromoDismissed(true);
  };

  const openConsultPopup = () => {
    setConsultPopupOpen(true);
    setFloatingMenuOpen(false);
    setTimeout(() => {
      const target = document.getElementById("floating-consult-form");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };


  const cities = catalogOptions.cities;
  const displayPhone = siteSettings.phone || DEFAULT_SITE_SETTINGS.phone;
  const displayKakaoId = siteSettings.kakao_id || DEFAULT_SITE_SETTINGS.kakao_id;
  const displayKakaoUrl = siteSettings.kakao_url || DEFAULT_SITE_SETTINGS.kakao_url;
  const displayLogoUrl = siteSettings.logo_url || DEFAULT_SITE_SETTINGS.logo_url;

  const districts = catalogOptions.districts;
  const towns = catalogOptions.towns;
  const apartments = catalogOptions.apartments;
  const areas = catalogOptions.areas;

  useEffect(() => {
    let cancelled = false;

    async function loadSiteSettings() {
      try {
        const cached = readCachedSiteSettings();
        if (!cancelled && cached) setSiteSettings(cached);

        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false || !data?.settings) {
          throw new Error("사이트 설정을 불러오지 못했습니다.");
        }
        if (!cancelled) {
          const normalized = { ...DEFAULT_SITE_SETTINGS, ...data.settings };
          setSiteSettings(normalized);
          cacheSiteSettings(normalized);
        }
      } catch {
        if (!cancelled) {
          const fallback = readCachedSiteSettings();
          setSiteSettings(fallback || DEFAULT_SITE_SETTINGS);
        }
      }
    }

    loadSiteSettings();
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);
      setMarketError("");
      try {
        const query = new URLSearchParams({
          propertyType,
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          apartmentQuery,
          area: selectedArea,
        });

        const response = await fetch(`/api/property-catalog?${query.toString()}`, { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || data?.ok === false) {
          throw new Error(data?.message || "단지 목록을 불러오지 못했습니다.");
        }

        if (cancelled) return;
        setCatalogOptions(data.options);
        setCatalogSource(data.source || "");
        setCatalogNote(data.note || "");
        setSelectedCity(data.query.city || "");
        setSelectedDistrict(data.query.district || "");
        setSelectedTown(data.query.town || "");
        setSelectedApartment(data.query.apartment || "");
        setSelectedArea(data.query.area || "");
      } catch (error) {
        if (!cancelled) {
          setMarketError(error?.message || "단지 목록을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [propertyType, selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedArea]);



  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const hiddenUntil = Number(window.localStorage.getItem(POPUP_STORAGE_KEY) || 0);
      setPromoDismissed(Boolean(hiddenUntil && hiddenUntil > Date.now()));
    } finally {
      setPromoReady(true);
    }
  }, []);

  useEffect(() => {
    if (!repaymentType) {
      setInterestRate("");
      return;
    }
    const defaultRate = repaymentDefaults[repaymentType] || "";
    setInterestRate(defaultRate);
  }, [repaymentType]);

  useEffect(() => {
    if (currentView !== "home") {
      setFloatingMenuOpen(false);
      setConsultPopupOpen(false);
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "price-result") return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % statSlides.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [currentView]);

  const filteredApartments = useMemo(() => {
    const q = apartmentQuery.trim().toLowerCase();
    if (!q) return apartments;
    return apartments.filter((name) => name.toLowerCase().includes(q));
  }, [apartments, apartmentQuery]);

  
  const approvalTrackItems = useMemo(() => {
    const total = approvalCases.length;
    if (!total) return [];
    const pick = (index) => approvalCases[(index + total) % total];

    if (approvalDirection === "prev" && approvalAnimating) {
      return [
        pick(approvalSlide - 1),
        pick(approvalSlide),
        pick(approvalSlide + 1),
        pick(approvalSlide + 2),
      ];
    }

    return [
      pick(approvalSlide),
      pick(approvalSlide + 1),
      pick(approvalSlide + 2),
      pick(approvalSlide + 3),
    ];
  }, [approvalCases, approvalSlide, approvalDirection, approvalAnimating]);

  const approvalDotIndex = useMemo(() => {
    if (!approvalCases.length) return 0;
    return ((approvalSlide % approvalCases.length) + approvalCases.length) % approvalCases.length;
  }, [approvalCases.length, approvalSlide]);

  const selectedSummary = [selectedCity, selectedDistrict, selectedTown, selectedApartment].filter(Boolean).join(" ");
  const hasSelectedSummary = Boolean(selectedSummary || selectedArea || selectedUnit);
  const marketSummary = marketResult?.summary;

  const priceResult = useMemo(() => {
    if (marketSummary) {
      return {
        title: marketSummary.title || selectedApartment || "선택 단지",
        address: marketSummary.address || `${selectedCity} ${selectedDistrict} ${selectedTown}`,
        area: marketSummary.area || selectedArea || "84.96㎡",
        floor: "선택 조건 기준",
        tradeDate: marketSummary.tradeDate || "최신 기준",
        latestPrice: marketSummary.latestPrice || "조회값 없음",
        range: marketSummary.range || "조회값 없음",
        estimateLimit: marketSummary.estimateLimit || "상담 후 산정",
      };
    }

    return {
      title: selectedApartment || "선택 단지",
      address: `${selectedCity} ${selectedDistrict} ${selectedTown}`,
      area: selectedArea || "84.96㎡",
      floor: "101동 12층",
      tradeDate: "2026.03.18",
      latestPrice: "8억 7,500만원",
      range: "8억 3,000만원 ~ 8억 9,000만원",
      estimateLimit: "최대 6억 1,000만원 가능",
    };
  }, [marketSummary, selectedApartment, selectedArea, selectedCity, selectedDistrict, selectedTown]);

  
  useEffect(() => {
    if (approvalCases.length <= 1 || approvalAnimating) return;
    const timer = setInterval(() => {
      setApprovalDirection("next");
      setApprovalAnimating(true);
      const done = setTimeout(() => {
        setApprovalSlide((prev) => (prev + 1) % approvalCases.length);
        setApprovalAnimating(false);
      }, 560);
      return () => clearTimeout(done);
    }, 3400);
    return () => clearInterval(timer);
  }, [approvalCases.length, approvalAnimating]);

  const calcResult = useMemo(() => {
    const principal = Number(String(loanAmount).replace(/,/g, ""));
    const annualRate = Number(interestRate);
    const months = Number(loanMonths);

    if (!principal || !annualRate || !months || months <= 0) {
      return { monthlyPayment: 0, totalInterest: 0, totalPayment: 0 };
    }

    const monthlyRate = annualRate / 100 / 12;
    let monthlyPayment = 0;
    let totalPayment = 0;
    let totalInterest = 0;

    if (repaymentType === "원리금균등") {
      if (monthlyRate === 0) {
        monthlyPayment = principal / months;
      } else {
        monthlyPayment =
          (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
          (Math.pow(1 + monthlyRate, months) - 1);
      }
      totalPayment = monthlyPayment * months;
      totalInterest = totalPayment - principal;
    } else if (repaymentType === "원금균등") {
      const monthlyPrincipal = principal / months;
      const avgMonthlyInterest =
        (principal * monthlyRate + monthlyPrincipal * monthlyRate) / 2;
      monthlyPayment = monthlyPrincipal + avgMonthlyInterest;
      totalInterest = (principal * monthlyRate * (months + 1)) / 2;
      totalPayment = principal + totalInterest;
    } else {
      monthlyPayment = principal * monthlyRate;
      totalInterest = monthlyPayment * months;
      totalPayment = principal + totalInterest;
    }

    return { monthlyPayment, totalInterest, totalPayment };
  }, [loanAmount, interestRate, repaymentType, loanMonths]);

  const toggleTradeType = (key) => {
    setTradeTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMarketSearch = async () => {
    const finalApartment = selectedApartment;

    setMarketLoading(true);
    setMarketError("");

    try {
      const query = new URLSearchParams({
        propertyType,
        city: selectedCity,
        district: selectedDistrict,
        town: selectedTown,
        apartment: finalApartment,
        area: selectedArea,
      });

      const response = await fetch(`/api/reb-market?${query.toString()}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || "시세 정보를 불러오지 못했습니다.");
      }

      setMarketResult(data);
      setCurrentView("price-result");
    } catch (error) {
      setMarketError(error?.message || "시세 정보를 불러오지 못했습니다.");
      setCurrentView("price-result");
    } finally {
      setMarketLoading(false);
    }
  };

  const submitHomeInquiry = async (e) => {
    e.preventDefault();
    if (!homeInquiry.name.trim() || !homeInquiry.phone.trim()) {
      setHomeInquiryStatus("성함과 연락처를 입력해주세요.");
      return;
    }
    setHomeInquirySaving(true);
    setHomeInquiryStatus("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...homeInquiry,
          sourcePage: "home",
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "상담접수를 저장하지 못했습니다.");
      setHomeInquiryStatus("상담접수가 완료되었습니다. 확인 후 빠르게 연락드리겠습니다.");
      setHomeInquiry({ name: "", phone: "", address: "", loanType: loanTypeOptions[0] });
    } catch (error) {
      setHomeInquiryStatus(error?.message || "상담접수를 저장하지 못했습니다.");
    } finally {
      setHomeInquirySaving(false);
    }
  };

  const submitResultInquiry = async (e) => {
    e.preventDefault();
    if (!resultInquiry.name.trim() || !resultInquiry.phone.trim()) {
      setResultInquiryStatus("성함과 연락처를 입력해주세요.");
      return;
    }
    setResultInquirySaving(true);
    setResultInquiryStatus("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...resultInquiry,
          address: [selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedUnit].filter(Boolean).join(" "),
          sourcePage: "price-result",
          propertyType,
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          area: selectedArea,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "대출 신청을 저장하지 못했습니다.");
      setResultInquiryStatus("대출 신청이 접수되었습니다. 확인 후 빠르게 연락드리겠습니다.");
      setResultInquiry({ name: "", phone: "", loanType: loanTypeOptions[0], memo: "" });
    } catch (error) {
      setResultInquiryStatus(error?.message || "대출 신청을 저장하지 못했습니다.");
    } finally {
      setResultInquirySaving(false);
    }
  };

  return (
    <div className="site-wrap">
      <header className="header">
        <div className="container header-inner">
          <div className="brand brand-logo-wrap">
            <img src={displayLogoUrl} alt={siteSettings.company_name || "엔드아이에셋대부"} className="brand-logo" />
            <div className="brand-copy">
              <div className="brand-title">{siteSettings.company_name || "엔드아이에셋대부"}</div>
              <div className="brand-sub">{siteSettings.company_subtitle || "주택담보대출 · 대환대출 · 전세퇴거자금 상담"}</div>
            </div>
          </div>

          <nav className="nav">
            <a href="#intro">홈</a>
            <a href="#quick-search">시세조회</a>
            <a href="#calculator">이율계산기</a>
            {Boolean(siteSettings.reviews_enabled) ? <a href="#approval-cases">승인사례</a> : null}
            <button type="button" className="nav-btn" onClick={openConsultPopup}>상담 신청</button>
          </nav>
        </div>
      </header>

      {currentView === "home" && Boolean(siteSettings.notice_enabled) && (
        <div className="top-notice-bar">
          <div className="container top-notice-inner">
            <span className="top-notice-badge">공지</span>
            <span className="top-notice-text">{siteSettings.notice_text || DEFAULT_SITE_SETTINGS.notice_text}</span>
          </div>
        </div>
      )}

      {promoReady && currentView === "home" && Boolean(siteSettings.popup_enabled) && !promoDismissed && (
        <div className="floating-promo-card">
          <button type="button" className="floating-promo-close" onClick={closePromoForToday}>×</button>
          <div className="floating-promo-badge">오늘 상담 가능</div>
          <div className="floating-promo-title">{siteSettings.popup_title || "대출 상담 빠르게 연결해드려요"}</div>
          <p className="floating-promo-text">{siteSettings.popup_description || "간편 접수나 카카오톡으로 바로 문의하시면 순차적으로 확인 후 연락드립니다."}</p>
          <div className="floating-promo-actions">
            <button type="button" className="floating-promo-main" onClick={openConsultPopup}>{siteSettings.popup_button_text || siteSettings.consult_button_text || "상담 신청"}</button>
            <button type="button" className="floating-promo-sub" onClick={closePromoForToday}>오늘 그만보기</button>
          </div>
        </div>
      )}

      {currentView === "home" && (
        <div className="floating-contact-toolbar premium-floating fixed-visible">
          <a href={`tel:${displayPhone}`} className="floating-contact-btn floating-contact-btn-call floating-contact-btn-solid-call">
            <span className="floating-contact-icon">☎</span>
            <span>대표번호<small>{displayPhone}</small></span>
          </a>
          <a href={displayKakaoUrl} target="_blank" rel="noreferrer" className="floating-contact-btn floating-contact-btn-kakao floating-contact-btn-solid-kakao">
            <span className="floating-contact-icon floating-contact-icon-kakao">TALK</span>
            <span>카카오상담<small>{`카카오톡 ID : ${displayKakaoId}`}</small></span>
          </a>
        </div>
      )}

      <main>
        {currentView === "home" && (
          <>
            <section id="intro" className="hero premium-hero" data-reveal="up">
              <div className="hero-glow hero-glow-1" />
              <div className="hero-glow hero-glow-2" />

              <div className="container hero-grid">
                <div className="hero-left">
                  <div className="hero-pill hero-pill-live">{siteSettings.hero_badge || "실시간 시세조회 · 맞춤 대출 상담"}</div>

                  <h1 className="hero-title hero-title-premium">
                    {(siteSettings.hero_title || "내 아파트 시세,\n지금 바로 확인하고\n대출 상담까지").split("\n").map((line, index, arr) => (
                      <span key={index}>
                        {line}
                        {index < arr.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </h1>

                  <p className="hero-text hero-text-premium">
                    {(siteSettings.hero_description || "아파트 시세를 조회하고, 예상 가능 한도를 확인한 뒤\n전문 상담사에게 바로 연결됩니다.").split("\n").map((line, index, arr) => (
                      <span key={index}>
                        {line}
                        {index < arr.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </p>

                  <div className="hero-actions">
                    <a href="#quick-search" className="btn btn-white">{siteSettings.hero_primary_cta || "빠른 시세조회"}</a>
                    <button type="button" className="btn btn-outline dark-outline" onClick={openConsultPopup}>{siteSettings.hero_secondary_cta || "무료 상담 신청"}</button>
                  </div>

                  <div className="hero-feature-list">
                    <span className="hero-feature-chip">{siteSettings.hero_feature_1 || "실시간 단지 조회"}</span>
                    <span className="hero-feature-chip">{siteSettings.hero_feature_2 || "맞춤 한도 상담"}</span>
                    <span className="hero-feature-chip">{siteSettings.hero_feature_3 || "빠른 접수 진행"}</span>
                  </div>

                  <div className="hero-highlight-grid">
                    <div className="hero-highlight-card">
                      <span>맞춤 상담</span>
                      <strong>1:1 진행</strong>
                      <small>조건에 맞는 상품 안내</small>
                    </div>
                    <div className="hero-highlight-card">
                      <span>시세 확인</span>
                      <strong>간편 조회</strong>
                      <small>주소 선택 후 바로 확인</small>
                    </div>
                    <div className="hero-highlight-card">
                      <span>상담 채널</span>
                      <strong>전화 · 카카오톡</strong>
                      <small>편한 방식으로 문의 가능</small>
                    </div>
                  </div>
                </div>

                <div className="hero-card premium-glass-card" data-reveal="up">
                  <div className="section-mini">간편 상담 접수</div>
                  <h2 className="card-title">{siteSettings.hero_secondary_cta || "무료 상담 신청"}</h2>

                  <form className="form-stack" onSubmit={submitHomeInquiry}>
                    <div className="field">
                      <label>성함</label>
                      <input type="text" placeholder="성함을 입력하세요" value={homeInquiry.name} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>연락처</label>
                      <input type="text" placeholder="연락처를 입력하세요" value={homeInquiry.phone} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, phone: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>주소 입력</label>
                      <input type="text" placeholder="주소를 입력하세요" value={homeInquiry.address} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, address: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>대출유형</label>
                      <select value={homeInquiry.loanType} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, loanType: e.target.value }))}>
                        {loanTypeOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    {homeInquiryStatus && <div className={`api-status ${homeInquiryStatus.includes("완료") ? "success" : "error"}`}>{homeInquiryStatus}</div>}
                    <button type="submit" className="primary-btn" disabled={homeInquirySaving}>{homeInquirySaving ? "접수 중..." : "상담 신청하기"}</button>
                  </form>
                </div>
              </div>
            </section>

            <section id="quick-search" className="section" data-reveal="up">
              <div className="container">
                <div className="white-panel">
                  <div className="section-center">
                    <div className="section-mini">시세조회</div>
                    <h2 className="section-title">내 아파트 시세 조회</h2>
                    <p className="section-copy">지역과 단지를 선택하면 현재 기준 시세와 상담 연결까지 한 번에 진행할 수 있습니다.</p>
                  </div>

                  <div className="quick-search-box quick-search-box-staged">
                    <div className="quick-search-head">
                      <div>
                        <div className="quick-search-eyebrow">STEP 01</div>
                        <div className="quick-search-title">아파트 정보를 선택해 주세요</div>
                      </div>
                      <div className="quick-search-badges">
                        <span>광역시/도</span>
                        <span>단지</span>
                        <span>면적</span>
                      </div>
                    </div>
                    <div className="select-grid select-grid-3">
                      <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setSelectedDistrict(""); setSelectedTown(""); setSelectedApartment(""); setApartmentQuery(""); setSelectedArea(""); setSelectedUnit(""); }}>
                        <option value="">광역시/도</option>
                        {cities.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>

                      <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedTown(""); setSelectedApartment(""); setApartmentQuery(""); setSelectedArea(""); setSelectedUnit(""); }} disabled={!selectedCity}>
                        <option value="">시/군/구</option>
                        {districts.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>

                      <select value={selectedTown} onChange={(e) => { setSelectedTown(e.target.value); setSelectedApartment(""); setApartmentQuery(""); setSelectedArea(""); setSelectedUnit(""); }} disabled={!selectedDistrict}>
                        <option value="">읍/면/동</option>
                        {towns.map((town) => (
                          <option key={town} value={town}>{town}</option>
                        ))}
                      </select>
                    </div>

                    <div className="select-grid select-grid-3 staged-grid-bottom">
                      <select value={selectedApartment} onChange={(e) => { setSelectedApartment(e.target.value); setApartmentQuery(e.target.value); setSelectedArea(""); }} disabled={!selectedTown}>
                        <option value="">아파트</option>
                        {apartments.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>

                      <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} disabled={!selectedApartment}>
                        <option value="">면적</option>
                        {areas.map((area) => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={selectedUnit}
                        placeholder="동·호수"
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        disabled={!selectedArea}
                      />
                    </div>

                    <div className="quick-search-divider" />

                    <div className="quick-search-actions">
                      {hasSelectedSummary ? (
                        <div className="selected-text">
                          선택 항목: <strong>{selectedSummary}</strong>
                          {selectedArea ? <> / <strong>{selectedArea}</strong></> : null}
                          {selectedUnit ? <> / <strong>{selectedUnit}</strong></> : null}
                        </div>
                      ) : <div />}
                      <button
                        type="button"
                        className="search-btn"
                        onClick={handleMarketSearch}
                        disabled={marketLoading || !selectedCity || !selectedDistrict || !selectedTown || !selectedApartment || !selectedArea}
                      >
                        {marketLoading ? "조회 중..." : "시세 조회하기"}
                      </button>
                    </div>

                    {marketError && <div className="api-status error">{marketError}</div>}
                  </div>
                </div>
              </div>
            </section>

            <section className="home-info-strip" data-reveal="up">
              <div className="container">
                <div className="home-info-grid home-info-grid-3">
                  <div className="home-info-box contact-home-box contact-home-box-split" data-reveal="up">
                    <div className="contact-split-grid contact-split-grid-soft">
                      <a href="tel:070-8018-7437" className="contact-display-card phone-display-card">
                        <div className="contact-display-badge">대표번호</div>
                        <div className="contact-display-icon phone-display-icon">☎</div>
                        <div className="contact-display-title">전화 상담</div>
                        <div className="contact-display-main contact-display-main-phone"><span>070-8018</span><span>7437</span></div>
                        <div className="contact-display-sub">빠른 상담 연결</div>
                        <div className="contact-display-mini">대표 상담번호로 바로 연결됩니다.</div>
                      </a>

                      <a href="https://open.kakao.com/o/sbaltXmi" target="_blank" rel="noreferrer" className="contact-display-card kakao-display-card">
                        <div className="contact-display-badge contact-display-badge-kakao">카카오톡</div>
                        <div className="kakao-symbol">TALK</div>
                        <div className="contact-display-title">카카오톡 상담</div>
                        <div className="contact-display-main contact-display-main-kakao"><span>ANDi7437</span></div>
                        <div className="contact-display-sub">오픈채팅 바로 연결</div>
                        <div className="contact-display-mini">클릭하면 상담창으로 이동합니다.</div>
                      </a>
                    </div>
                  </div>

                  <div id="calculator" className="home-info-box calculator-home-box premium-calc-panel" data-reveal="up">
                    <div className="section-mini">이율 계산기</div>
                    <h3 className="home-calc-title">간편 이율계산기</h3>
                    <div className="two-col compact-two-col">
                      <input
                        type="text"
                        placeholder="대출 금액"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      />
                      <input
                        type="text"
                        placeholder="연 이율(%)"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9.]/g, ""))}
                      />
                    </div>
                    <div className="two-col compact-two-col">
                      <select value={repaymentType} onChange={(e) => setRepaymentType(e.target.value)}>
                        <option value="">상환방식을 선택</option>
                        <option value="원리금균등">원리금균등</option>
                        <option value="원금균등">원금균등</option>
                        <option value="만기일시상환">만기일시상환</option>
                      </select>
                      <input
                        type="text"
                        placeholder="기간(개월)"
                        value={loanMonths}
                        onChange={(e) => setLoanMonths(e.target.value.replace(/[^0-9]/g, ""))}
                      />
                    </div>
                    <div className="calc-box home-calc-box">
                      <div className="calc-label">예상 월 상환액</div>
                      <div className="calc-main">{formatNumber(calcResult.monthlyPayment)}원</div>
                    </div>
                    <div className="calc-helper">상환방식을 선택하면 기준 이율이 자동 입력되며, 연 이율은 직접 수정할 수 있습니다. 금액과 기간을 입력해 월 상환 예상액을 확인해보세요.</div>
                  </div>
                </div>
              </div>
            </section>

            {Boolean(siteSettings.reviews_enabled) ? (
              <section id="approval-cases" className="review-section approval-section" data-reveal="up">
                <div className="container review-grid approval-grid">
                  <div className="review-left approval-left">
                    <div className="section-mini">Approval Cases</div>
                    <div className="review-title">승인사례</div>
                    <p className="review-copy">실제 상담 진행 사례를 확인해 보세요.</p>
                  </div>

                  
<div className="review-list approval-list approval-slider-list" data-reveal="up">
                    {approvalCases.length === 0 ? (
                      <div className="review-card approval-card">
                        <div className="approval-card-badge">준비중</div>
                        <div className="review-card-title">승인사례를 준비 중입니다.</div>
                        <div className="review-card-desc">잠시 후 다시 확인해 주세요.</div>
                      </div>
                    ) : (
                      <>
                        <div className="approval-slider-toolbar">
                          <button
                            type="button"
                            className="approval-slider-arrow"
                            aria-label="이전 승인사례"
                            onClick={() => {
                              if (approvalAnimating || approvalCases.length <= 1) return;
                              setApprovalDirection("prev");
                              setApprovalAnimating(true);
                              setTimeout(() => {
                                setApprovalSlide((prev) => (prev - 1 + approvalCases.length) % approvalCases.length);
                                setApprovalAnimating(false);
                              }, 560);
                            }}
                          >
                            ‹
                          </button>

                          <div className="approval-slider-dots">
                            {approvalCases.map((item, idx) => (
                              <button
                                key={item.id || idx}
                                type="button"
                                className={`approval-slider-dot ${idx === approvalDotIndex ? "is-active" : ""}`}
                                aria-label={`${idx + 1}번째 승인사례`}
                                onClick={() => {
                                  if (approvalAnimating || idx === approvalDotIndex) return;
                                  const direction = idx > approvalDotIndex ? "next" : "prev";
                                  setApprovalDirection(direction);
                                  setApprovalAnimating(true);
                                  setTimeout(() => {
                                    setApprovalSlide(idx);
                                    setApprovalAnimating(false);
                                  }, 560);
                                }}
                              />
                            ))}
                          </div>

                          <button
                            type="button"
                            className="approval-slider-arrow"
                            aria-label="다음 승인사례"
                            onClick={() => {
                              if (approvalAnimating || approvalCases.length <= 1) return;
                              setApprovalDirection("next");
                              setApprovalAnimating(true);
                              setTimeout(() => {
                                setApprovalSlide((prev) => (prev + 1) % approvalCases.length);
                                setApprovalAnimating(false);
                              }, 560);
                            }}
                          >
                            ›
                          </button>
                        </div>

                        <div className="approval-slider-window">
                          <div
                            className={`approval-slider-track ${approvalAnimating ? "is-animating" : ""} approval-direction-${approvalDirection}`}
                          >
                            {approvalTrackItems.map((item, idx) => (
                              <article
                                key={`${item.id || item.title || "approval"}-${approvalDirection}-${approvalSlide}-${idx}`}
                                className={`review-card approval-card ${idx === 0 && approvalDirection === "next" ? "is-primary" : ""}`}
                              >
                                <div className="approval-card-badge">승인</div>
                                <div className="review-card-title">{item.customerName || item.title}</div>
                                <div className="review-card-desc">
                                  <div>{item.currentLoan || item.content}</div>
                                  {item.approvalResult ? <div style={{ marginTop: 8, fontWeight: 700, color: "#2457d6" }}>{item.approvalResult}</div> : null}
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}

        {currentView === "price-result" && (
          <section className="result-page-section">
            <div className="container">
              <div className="result-page-topbar">
                <button type="button" className="back-btn" onClick={() => setCurrentView("home")}>
                  ← 시세조회로 돌아가기
                </button>
              </div>

              <div className="result-page-search-shell">
                <div className="result-stat-wrap">
                  <div className="result-stat-head">
                    <div className="result-stat-title">시장 통계 <span>2026.03.16 기준</span></div>
                    <a href="#">통계 더보기 〉</a>
                  </div>

                  <div className="result-stat-banner">
                    <span className="result-stat-icon">↗</span>
                    <span>{statSlides[activeSlide].message}</span>
                    <strong>{activeSlide + 1}/{statSlides.length}</strong>
                  </div>

                  <div className="result-stat-grid">
                    {statSlides[activeSlide].items.map((item) => (
                      <div key={item.label} className="result-stat-box">
                        <div className="result-stat-label">{item.label}</div>
                        <div className="result-stat-row">
                          <span>전국</span>
                          <strong>{item.nation}</strong>
                          <em>{item.nationDiff}</em>
                        </div>
                        <div className="result-stat-row">
                          <span>서울</span>
                          <strong>{item.seoul}</strong>
                          <em>{item.seoulDiff}</em>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="result-stat-dots">
                    {statSlides.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`result-dot ${activeSlide === idx ? "active" : ""}`}
                        onClick={() => setActiveSlide(idx)}
                      />
                    ))}
                  </div>
                </div>

                <div className="result-search-panel">
                  <div className="result-search-row">
                    <div className="result-search-label">물건 유형</div>
                    <div className="result-type-tabs">
                      {["아파트", "오피스텔", "빌라(연립/다세대)"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={`result-type-tab ${propertyType === type ? "active" : ""}`}
                          onClick={() => setPropertyType(type)}
                        >
                          {type}
                          {type === "빌라(연립/다세대)" && <span className="result-new-badge">NEW</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="result-search-row">
                    <div className="result-search-label">지역 선택</div>
                    <div className="result-form-grid result-form-grid-3">
                      <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setSelectedDistrict(""); setSelectedTown(""); setSelectedApartment(""); setSelectedArea(""); }}>
                        <option value="">광역시/도</option>
                        {cities.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                      <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedTown(""); setSelectedApartment(""); setSelectedArea(""); }}>
                        <option value="">시/군/구</option>
                        {districts.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                      <select value={selectedTown} onChange={(e) => { setSelectedTown(e.target.value); setSelectedApartment(""); setSelectedArea(""); }}>
                        <option value="">읍/면/동</option>
                        {towns.map((town) => (
                          <option key={town} value={town}>{town}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="result-search-row">
                    <div className="result-search-label">단지 선택</div>
                    <div className="result-form-grid result-form-grid-complex">
                      <div className="apartment-picker">
                        <input
                          type="text"
                          value={apartmentQuery}
                          placeholder="단지명을 입력하거나 선택하세요"
                          onChange={(e) => {
                            setApartmentQuery(e.target.value);
                            setShowApartmentList(true);
                          }}
                          onFocus={() => setShowApartmentList(true)}
                        />
                        {showApartmentList && filteredApartments.length > 0 && (
                          <div className="apartment-dropdown">
                            {filteredApartments.map((name) => (
                              <button
                                key={name}
                                type="button"
                                className={`apartment-option ${selectedApartment === name ? "active" : ""}`}
                                onClick={() => {
                                  setSelectedApartment(name);
                                  setApartmentQuery(name);
                                  setShowApartmentList(false);
                                }}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                        <option value="">면적</option>
                        {areas.map((area) => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="primary-btn result-query-btn"
                        onClick={handleMarketSearch}
                      >
                        {marketLoading ? "조회 중..." : "다시 조회"}
                      </button>
                    </div>
                  </div>

                  <div className="result-search-row trade-row">
                    <div className="result-search-label">거래 유형</div>
                    <div className="trade-checks">
                      <label className="trade-check">
                        <input type="checkbox" checked={tradeTypes.sale} onChange={() => toggleTradeType("sale")} />
                        <span>매매</span>
                      </label>
                      <label className="trade-check">
                        <input type="checkbox" checked={tradeTypes.jeonse} onChange={() => toggleTradeType("jeonse")} />
                        <span>전세</span>
                      </label>
                      <label className="trade-check">
                        <input type="checkbox" checked={tradeTypes.monthly} onChange={() => toggleTradeType("monthly")} />
                        <span>월세</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="result-page-hero">
                <div>
                  <div className="section-mini light-mini">시세조회 결과</div>
                  <h2 className="result-page-title">{priceResult.title}</h2>
                  <p className="result-page-sub">
                    {priceResult.address} · {priceResult.area} · {priceResult.floor}
                  </p>
                </div>
                <a href="#contact" className="white-pill-btn">상담 신청</a>
              </div>

              <div className="result-page-grid">
                <div className="result-main-card">
                  <div className="info-grid result-info-grid">
                    <div className="info-card">
                      <div className="info-label">최근 실거래가</div>
                      <div className="info-value">{priceResult.latestPrice}</div>
                      <div className="info-sub">기준일 {priceResult.tradeDate}</div>
                    </div>
                    <div className="info-card">
                      <div className="info-label">최근 거래 범위</div>
                      <div className="info-value">{priceResult.range}</div>
                      <div className="info-sub">최근 조회 기준</div>
                    </div>
                    <div className="info-card">
                      <div className="info-label">전용면적 / 층</div>
                      <div className="info-value">{priceResult.area}</div>
                      <div className="info-sub">{priceResult.floor}</div>
                    </div>
                    <div className="info-card">
                      <div className="info-label">예상 가능 한도</div>
                      <div className="info-value">{priceResult.estimateLimit}</div>
                      <div className="info-sub">상담 후 세부조건 반영</div>
                    </div>
                  </div>

                  <div className="condition-card">
                    <div className="section-mini">조건 안내</div>
                    <h3 className="desc-title">시세 정보 기준 추천 조건</h3>

                    <div className="condition-list">
                      <div className="condition-item">
                        <div className="condition-left">
                          <div className="condition-name">1금융</div>
                          <div className="condition-desc">시세 80% 금리 4.5%~</div>
                        </div>
                        <div className="condition-badge condition-blue">안정형</div>
                      </div>

                      <div className="condition-item">
                        <div className="condition-left">
                          <div className="condition-name">저축은행 캐피탈</div>
                          <div className="condition-desc">시세 90% 금리 5.9%~</div>
                        </div>
                        <div className="condition-badge condition-indigo">확장형</div>
                      </div>

                      <div className="condition-item">
                        <div className="condition-left">
                          <div className="condition-name">대부, P2P</div>
                          <div className="condition-desc">시세 95% 금리 7.9%~</div>
                        </div>
                        <div className="condition-badge condition-purple">고한도형</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="result-side-col">
                  <div id="contact" className="side-card">
                    <div className="section-mini">상담 신청</div>
                    <h3 className="card-title">지금 바로 상담받기</h3>

                    <form className="form-stack" onSubmit={submitResultInquiry}>
                      <input type="text" placeholder="성함" value={resultInquiry.name} onChange={(e) => setResultInquiry((prev) => ({ ...prev, name: e.target.value }))} />
                      <input type="text" placeholder="연락처 (예: 010-1234-5678)" value={resultInquiry.phone} onChange={(e) => setResultInquiry((prev) => ({ ...prev, phone: e.target.value }))} />
                      <input type="text" value={`${selectedApartment} / ${selectedArea}`} readOnly className="readonly-field" />
                      <select value={resultInquiry.loanType} onChange={(e) => setResultInquiry((prev) => ({ ...prev, loanType: e.target.value }))}>
                        {loanTypeOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <textarea rows={3} placeholder="추가 문의사항이 있으시면 입력해주세요" value={resultInquiry.memo} onChange={(e) => setResultInquiry((prev) => ({ ...prev, memo: e.target.value }))} />
                      {resultInquiryStatus && <div className={`api-status ${resultInquiryStatus.includes("완료") ? "success" : "error"}`}>{resultInquiryStatus}</div>}
                      <button type="submit" className="primary-btn" disabled={resultInquirySaving}>{resultInquirySaving ? "접수 중..." : "상담 신청하기"}</button>
                    </form>
                  </div>

                  <div className="side-card">
                    <div className="section-mini">상담 채널</div>
                    <h3 className="card-title">전화 · 카카오톡 상담</h3>
                    <div className="contact-button-stack contact-button-stack-compact">
                      <a href="tel:070-8018-7437" className="contact-pill contact-pill-call">
                        <span className="contact-pill-icon">☎</span>
                        <span className="contact-pill-copy">
                          <strong>대표번호</strong>
                          <small>070-8018-7437</small>
                        </span>
                      </a>
                      <a href="https://open.kakao.com/o/sbaltXmi" target="_blank" rel="noreferrer" className="contact-pill contact-pill-kakao">
                        <span className="contact-pill-icon contact-pill-icon-kakao">TALK</span>
                        <span className="contact-pill-copy contact-pill-copy-dark">
                          <strong>카카오상담</strong>
                          <small>카카오톡 ID : ANDi7437</small>
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}


        {consultPopupOpen && currentView === "home" && (
          <div className="floating-consult-modal-shell" onClick={() => setConsultPopupOpen(false)}>
            <div
              id="floating-consult-form"
              className="floating-consult-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="floating-consult-close" onClick={() => setConsultPopupOpen(false)}>×</button>
              <div className="section-mini">빠른 상담 신청</div>
              <h3 className="card-title">지금 바로 간편 접수</h3>
              <form className="form-stack" onSubmit={submitHomeInquiry}>
                <div className="field">
                  <label>성함</label>
                  <input type="text" placeholder="성함을 입력하세요" value={homeInquiry.name} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="field">
                  <label>연락처</label>
                  <input type="text" placeholder="연락처를 입력하세요" value={homeInquiry.phone} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="field">
                  <label>주소 입력</label>
                  <input type="text" placeholder="주소를 입력하세요" value={homeInquiry.address} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="field">
                  <label>대출유형</label>
                  <select value={homeInquiry.loanType} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, loanType: e.target.value }))}>
                    {loanTypeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                {homeInquiryStatus && <div className={`api-status ${homeInquiryStatus.includes("완료") ? "success" : "error"}`}>{homeInquiryStatus}</div>}
                <button type="submit" className="primary-btn" disabled={homeInquirySaving}>{homeInquirySaving ? "접수 중..." : "상담 신청하기"}</button>
              </form>
            </div>
          </div>
        )}
        <section id="faq" className="section faq-section" data-reveal="up">
          <div className="container faq-wrap faq-wrap-wide">
            <div className="section-center faq-header-left">
              <h2 className="faq-main-title">주택담보대출 금리비교 FAQ</h2>
            </div>

            <div className="faq-list faq-list-static">
              <div className="faq-item faq-item-static">
                <div className="faq-question">Q. 주택담보대출 금리비교는 왜 꼭 해야 하나요?</div>
                <p>주담대 금리는 금융사·상품·우대조건·상환방식·중도상환수수료에 따라 실제 부담이 달라질 수 있습니다. 금리만 비교하기보다, 기준금리/우대조건/수수료/부대비용을 함께 비교하면 내 상황에 맞는 “실질적으로 유리한 조건”을 찾기 쉬워집니다.</p>
              </div>
              <div className="faq-item faq-item-static">
                <div className="faq-question">Q. 주택담보대출 한도와 금리는 무엇으로 결정되나요?</div>
                <p>일반적으로 담보물 평가, LTV·DSR 등 규제/심사 기준, 소득 및 상환능력, 신용점수, 기존 부채, 상품 구조(고정·변동/기준금리)에 따라 달라집니다. 같은 담보라도 개인 조건과 상품 구조에 따라 결과가 달라질 수 있어 비교가 중요합니다.</p>
              </div>
              <div className="faq-item faq-item-static">
                <div className="faq-question">Q. 고정금리와 변동금리, 어떤 기준으로 선택하면 좋을까요?</div>
                <p>금리 하락 기대만으로 변동을 선택하기보다는, 향후 금리 변동 시나리오와 가계 현금흐름(상환 여력), 대출 계획(갈아타기 가능성), 변동 주기·기준금리를 함께 고려하는 것이 안전합니다. 고정은 안정성, 변동은 시장금리 반영이라는 특징이 있습니다.</p>
              </div>
              <div className="faq-item faq-item-static">
                <div className="faq-question">Q. 주담대 갈아타기(대환대출)할 때 가장 많이 놓치는 포인트는 무엇인가요?</div>
                <p>중도상환수수료, 부대비용(인지세/설정/감정 등), 우대조건 유지 가능성, 상환방식 변화로 인한 총이자 차이를 놓치기 쉽습니다. “금리 차이로 줄어드는 이자”와 “발생 비용”을 함께 계산해 판단하는 것이 좋습니다.</p>
              </div>
              <div className="faq-item faq-item-static">
                <div className="faq-question">Q. 주담대 상환방식에는 어떤 종류가 있나요?</div>
                <p>대표적으로 원리금균등분할, 원금균등분할, 만기일시 상환이 있습니다. 같은 금리라도 상환방식에 따라 월 납입액과 총 이자 부담이 달라질 수 있어, 금리비교 시 상환방식까지 같이 비교하는 것이 좋습니다.</p>
              </div>
              <div className="faq-item faq-item-static">
                <div className="faq-question">Q. 무직자·주부·프리랜서처럼 소득 증빙이 어려워도 주담대가 가능한가요?</div>
                <p>가능성이 완전히 없지는 않지만, 금융사/상품/담보 조건에 따라 심사 기준이 크게 달라질 수 있습니다. 소득 증빙 방식, 기존 부채, 담보가치, 규제 적용 여부 등을 종합적으로 확인해야 하므로, 비교 및 상담을 통해 내 케이스 기준으로 확인하는 것이 안전합니다.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="legal-section">
          <div className="container">
            <div className="legal-lines">
              <div>이자율 : 연6% ~ 연20%이내 (연체이자율 연 7% ~ 20% 이내, 취급수수료 및 기타 부대비용없음)</div>
              <div>중개수수료를 요구하거나 받는 것은 불법입니다.</div>
              <div>과도한 빚, 고통의 시작입니다. 대출시 귀하의 신용등급이 하락할 수 있습니다.</div>
              <div>이 사이트에서 광고되는 상품들의 상환 기간은 모두 60일 이상이며 (최저 2개월, 최대 5년), 최대 연 이자율은 20%입니다.</div>
              <div>대부이자율 (연 이자율) 및 연체이자율은 연 20%를 초과할 수 없습니다. (조기상환 조건없음)</div>
            </div>

            <div className="legal-meta">
              <span>상호 : 엔드아이에셋대부</span>
              <span>대표자(성명) : 최종원</span>
              <span>대표전화 : 070-8018-7437</span>
              <span>사업자등록번호 : 739-08-03168</span>
              <span>대부중개업 등록번호 : 2025-서울서초-0084</span>
              <span>대부업 등록번호 : 2025-서울서초-0083(대부업)</span>
              <span>사업자주소 : 서울특별시 서초구 서초중앙로 114, 일광빌딩 지하2층 B204호</span>
              <span>등록기관 : 서초구청 일자리경제과 (02-2155-8752)</span>
            </div>

            <div className="legal-copy">© 엔드아이에셋대부. All Rights Reserved.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
