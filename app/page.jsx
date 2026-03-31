"use client";

import { useEffect, useMemo, useState } from "react";
import { formatReviewDate } from "./lib-reviews";

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

const loanTypeOptions = [
  "주택담보대출",
  "전세퇴거자금",
  "경매취하자금",
  "사업자대출",
  "대환대출",
  "매매자금대출",
  "기타",
];

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

export default function LoanLandingPage() {
  useScrollReveal();
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("");

  const [propertyType, setPropertyType] = useState("아파트");
  const [tradeTypes, setTradeTypes] = useState({ sale: true, jeonse: true, monthly: true });
  const [currentView, setCurrentView] = useState("home");
  const [activeSlide, setActiveSlide] = useState(0);

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
  const [latestReviews, setLatestReviews] = useState([]);
  const [homeInquiry, setHomeInquiry] = useState({ name: "", phone: "", address: "", loanType: loanTypeOptions[0] });
  const [homeInquiryStatus, setHomeInquiryStatus] = useState("");
  const [homeInquirySaving, setHomeInquirySaving] = useState(false);
  const [resultInquiry, setResultInquiry] = useState({ name: "", phone: "", loanType: loanTypeOptions[0], memo: "" });
  const [resultInquiryStatus, setResultInquiryStatus] = useState("");
  const [resultInquirySaving, setResultInquirySaving] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(true);
  const [consultPopupOpen, setConsultPopupOpen] = useState(false);

  const closePromoForToday = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("landing-promo-hide-until", String(startOfTomorrow()));
    }
    setPromoDismissed(true);
  };

  const openConsultPopup = () => {
    setConsultPopupOpen(true);
    setTimeout(() => {
      const target = document.getElementById("floating-consult-form");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const cities = catalogOptions.cities;
  const districts = catalogOptions.districts;
  const towns = catalogOptions.towns;
  const apartments = catalogOptions.apartments;
  const areas = catalogOptions.areas;

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
    let cancelled = false;
    async function loadReviews() {
      try {
        const response = await fetch("/api/reviews?limit=3", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.message || "이용후기를 불러오지 못했습니다.");
        if (!cancelled) setLatestReviews(data.reviews || []);
      } catch {
        if (!cancelled) setLatestReviews([]);
      }
    }
    loadReviews();
    window.addEventListener("focus", loadReviews);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadReviews);
    };
  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const hiddenUntil = Number(window.localStorage.getItem("landing-promo-hide-until") || 0);
    setPromoDismissed(hiddenUntil > Date.now());
  }, []);

  useEffect(() => {
    if (currentView !== "home") {
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
        description:
          marketSummary.description ||
          "조회된 시세를 바탕으로 예상 가능 한도와 상담 방향을 빠르게 확인할 수 있습니다.",
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
      description:
        "선택하신 단지와 면적을 기준으로 최근 시세와 예상 가능 한도를 확인한 뒤 상담을 진행하실 수 있습니다.",
    };
  }, [marketSummary, selectedApartment, selectedArea, selectedCity, selectedDistrict, selectedTown]);

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
            <img src="/andi-logo.png" alt="엔드아이에셋대부" className="brand-logo" />
            <div className="brand-copy">
              <div className="brand-title">엔드아이에셋대부</div>
              <div className="brand-sub">주택담보대출 · 대환대출 · 전세퇴거자금 상담</div>
            </div>
          </div>

          <nav className="nav">
            <a href="#intro">홈</a>
            <a href="#quick-search">시세조회</a>
            <a href="#calculator">이율계산기</a>
            <a href="/reviews">이용후기</a>
            <a href="#contact" className="nav-btn">상담 신청</a>
          </nav>
        </div>
      </header>

      {currentView === "home" && !promoDismissed && (
        <div className="floating-promo-card" data-reveal="right">
          <button type="button" className="floating-promo-close" onClick={closePromoForToday}>×</button>
          <div className="floating-promo-badge">오늘 상담 가능</div>
          <div className="floating-promo-title">대출 상담 빠르게 연결해드려요</div>
          <p className="floating-promo-text">간편 접수나 카카오톡으로 바로 문의하시면 순차적으로 확인 후 연락드립니다.</p>
          <div className="floating-promo-actions">
            <button type="button" className="floating-promo-main" onClick={openConsultPopup}>상담 신청</button>
            <button type="button" className="floating-promo-sub" onClick={closePromoForToday}>오늘 그만보기</button>
          </div>
        </div>
      )}

      {currentView === "home" && (
        <div className="floating-contact-toolbar premium-floating always-open">
          <a href="tel:070-8018-7437" className="floating-contact-btn floating-contact-btn-call">
            <span className="floating-contact-icon">☎</span>
            <span>대표번호<small>070-8018-7437</small></span>
          </a>
          <a href="https://open.kakao.com/o/sbaltXmi" target="_blank" rel="noreferrer" className="floating-contact-btn floating-contact-btn-kakao">
            <span className="floating-contact-icon floating-contact-icon-kakao">TALK</span>
            <span>카카오상담<small>카카오톡 ID : ANDi7437</small></span>
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
                  <div className="hero-pill hero-pill-live">안정적인 상담 연결 · 프리미엄 대출 컨설팅</div>

                  <h1 className="hero-title hero-title-premium">
                    시세 확인부터
                    <br />
                    맞춤 상담 연결까지
                    <br />
                    빠르고 안정적으로
                  </h1>

                  <p className="hero-text hero-text-premium">
                    필요한 정보만 간편하게 입력하면 현재 시세 흐름과 예상 가능 범위를 확인하고
                    대출 가능 범위 확인과 상담 신청까지 빠르게 이어집니다.
                  </p>

                  <div className="hero-actions">
                    <a href="#quick-search" className="btn btn-white">빠른 시세조회</a>
                    <a href="#contact" className="btn btn-outline">무료 상담 신청</a>
                  </div>
                </div>

                <div className="hero-card premium-glass-card" data-reveal="up">
                  <div className="section-mini">빠른 상담 신청</div>
                  <h2 className="card-title">빠른 상담 접수</h2>
                  <p className="card-desc">
                    성함과 연락처를 남겨주시면 접수 확인 후 순차적으로 상담 도와드립니다.
                  </p>

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
                    <div className="section-mini">빠른 시세조회</div>
                    <h2 className="section-title">오늘의 부동산 시세와 예상 한도가 궁금하세요?</h2>
                  </div>

                  <div className="quick-search-box quick-search-box-staged">
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
                    <div className="section-mini">대출 이율 계산</div>
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
                        <option>원리금균등</option>
                        <option>원금균등</option>
                        <option>만기일시상환</option>
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
                    <div className="calc-helper">금액과 이율, 기간을 직접 입력해 월 상환 예상액을 확인해보세요.</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="review-section" data-reveal="up">
              <div className="container review-grid">
                <div className="review-left">
                  <div className="review-title">이용후기</div>
                  <a href="/reviews" className="review-more">더보기 →</a>
                </div>

                <div className="review-list" data-reveal="up">
                  {latestReviews.length === 0 && <div className="white-panel">아직 등록된 이용후기가 없습니다.</div>}
                  {latestReviews.map((review) => (
                    <a key={review.id} href={`/reviews/${review.id}`} className="review-card">
                      <div className="review-card-top">
                        <div className="review-card-text">
                          <div className="review-card-title">{review.title}</div>
                          <div className="review-card-desc">{review.content}</div>
                        </div>
                        <div className="review-card-date">{formatReviewDate(review.createdAt)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </section>
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
                    <div className="section-mini">예상 대출 조건</div>
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

                  <div className="desc-card">
                    <div className="section-mini">대출 상담 포인트</div>
                    <h3 className="desc-title">선택하신 단지 기준으로 상담 가능한 내용을 정리해드렸습니다.</h3>
                    <p className="desc-text">{priceResult.description}</p>

                    <div className="tag-wrap">
                      <span>{selectedCity}</span>
                      <span>{selectedDistrict}</span>
                      <span>{selectedTown}</span>
                      <span>{selectedApartment}</span>
                      <span>{selectedArea}</span>
                    </div>
                  </div>
                </div>

                <div className="result-side-col">
                  <div id="contact" className="side-card">
                    <div className="section-mini">대출 신청 작성란</div>
                    <h3 className="card-title">지금 바로 상담 신청</h3>
                    <p className="card-desc">
                      조회하신 단지와 면적 기준으로 상담사가 빠르게 연락드릴 수 있도록 필요한 정보만 간단히 접수받고 있습니다.
                    </p>

                    <form className="form-stack" onSubmit={submitResultInquiry}>
                      <input type="text" placeholder="성함" value={resultInquiry.name} onChange={(e) => setResultInquiry((prev) => ({ ...prev, name: e.target.value }))} />
                      <input type="text" placeholder="연락처" value={resultInquiry.phone} onChange={(e) => setResultInquiry((prev) => ({ ...prev, phone: e.target.value }))} />
                      <input type="text" value={`${selectedApartment} / ${selectedArea}`} readOnly />
                      <input type="text" value={marketResult?.source === "reb-openapi" ? "실시간 조회 기반 상담 준비" : "선택 조건 기준 상담 준비"} readOnly />
                      <select value={resultInquiry.loanType} onChange={(e) => setResultInquiry((prev) => ({ ...prev, loanType: e.target.value }))}>
                        {loanTypeOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <textarea rows={4} placeholder="상담 내용을 입력하세요" value={resultInquiry.memo} onChange={(e) => setResultInquiry((prev) => ({ ...prev, memo: e.target.value }))} />
                      {resultInquiryStatus && <div className={`api-status ${resultInquiryStatus.includes("완료") ? "success" : "error"}`}>{resultInquiryStatus}</div>}
                      <button type="submit" className="primary-btn" disabled={resultInquirySaving}>{resultInquirySaving ? "접수 중..." : "대출 신청 접수하기"}</button>
                    </form>
                  </div>

                  <div className="side-card">
                    <div className="section-mini">상담 채널 안내</div>
                    <h3 className="card-title">빠른 상담 연결</h3>
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
              data-reveal="left"
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
          <div className="container faq-wrap">
            <div className="section-center">
              <div className="section-mini">FAQ</div>
              <h2 className="section-title">자주 묻는 질문</h2>
            </div>

            <div className="faq-list">
              <details className="faq-item">
                <summary>시세조회 후 바로 대출 상담도 가능한가요?</summary>
                <p>네. 조회한 단지 정보와 함께 바로 상담 접수가 가능하며 확인 후 순차적으로 연락드립니다.</p>
              </details>
              <details className="faq-item">
                <summary>예상 한도와 금리는 바로 확정되나요?</summary>
                <p>아니요. 표시되는 내용은 참고용이며 실제 한도와 금리는 담보 조건과 심사 결과에 따라 달라질 수 있습니다.</p>
              </details>
              <details className="faq-item">
                <summary>이율 계산기는 입력 즉시 반영되나요?</summary>
                <p>네. 대출 금액과 이율, 기간을 입력하면 예상 월 상환액이 바로 계산됩니다.</p>
              </details>
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
