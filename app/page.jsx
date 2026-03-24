"use client";

import { useEffect, useMemo, useState } from "react";

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

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

export default function LoanLandingPage() {
  const [loanAmount, setLoanAmount] = useState("30000000");
  const [interestRate, setInterestRate] = useState("5.5");
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("36");

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
  const [selectedArea, setSelectedArea] = useState("");
  const [catalogOptions, setCatalogOptions] = useState({ cities: [], districts: [], towns: [], apartments: [], areas: [] });
  const [catalogSource, setCatalogSource] = useState("");
  const [catalogNote, setCatalogNote] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [marketResult, setMarketResult] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");

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
  }, [propertyType, selectedCity, selectedDistrict, selectedTown, selectedApartment, apartmentQuery, selectedArea]);

  useEffect(() => {
    if (currentView !== "price-result") return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % statSlides.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [currentView]);

  const filteredApartments = apartments;

  const selectedSummary = `${selectedCity} ${selectedDistrict} ${selectedTown} ${selectedApartment}`;
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
          "한국부동산원 API 기준으로 조회한 값을 기반으로 예상 조건과 상담 연결 흐름을 보여주는 화면입니다.",
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
        "선택하신 단지와 면적을 기준으로 최근 시세 흐름과 예상 가능 한도를 확인한 뒤 상담을 도와드리는 결과형 페이지 예시입니다.",
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
    const finalApartment = filteredApartments.includes(apartmentQuery)
      ? apartmentQuery
      : filteredApartments[0] || selectedApartment;

    if (finalApartment && finalApartment !== selectedApartment) {
      setSelectedApartment(finalApartment);
      setApartmentQuery(finalApartment);
    }

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

  return (
    <div className="site-wrap">
      <header className="header">
        <div className="container header-inner">
          <div className="brand">
            <div className="brand-icon">대</div>
            <div>
              <div className="brand-title">대출상담 브랜드명</div>
              <div className="brand-sub">빠른 상담 접수 랜딩페이지</div>
            </div>
          </div>

          <nav className="nav">
            <a href="#intro">홈</a>
            <a href="#quick-search">시세조회</a>
            <a href="#calculator">이율계산기</a>
            <a href="#contact" className="nav-btn">상담 신청</a>
          </nav>
        </div>
      </header>

      <main>
        {currentView === "home" && (
          <>
            <section id="intro" className="hero">
              <div className="hero-glow hero-glow-1" />
              <div className="hero-glow hero-glow-2" />

              <div className="container hero-grid">
                <div className="hero-left">
                  <div className="hero-pill">선택형 시세조회 · 빠른 상담 연결</div>

                  <h1 className="hero-title">
                    아파트 시세조회부터
                    <br />
                    대출 상담 신청까지
                    <br />
                    한 번에 연결되는 구조
                  </h1>

                  <p className="hero-text">
                    지역, 단지명, 면적을 차례대로 선택하고 조회를 누르면 결과형 페이지처럼
                    설명 영역과 상담 신청란이 이어지는 구조로 만든 시안입니다.
                  </p>

                  <div className="hero-actions">
                    <a href="#quick-search" className="btn btn-white">빠른 시세조회</a>
                    <a href="#contact" className="btn btn-outline">무료 상담 신청</a>
                  </div>
                </div>

                <div className="hero-card">
                  <div className="section-mini">빠른 상담 신청</div>
                  <h2 className="card-title">간편 접수</h2>
                  <p className="card-desc">
                    성함과 연락처를 남겨주시면 접수 확인 후 순차적으로 상담 도와드립니다.
                  </p>

                  <form className="form-stack">
                    <div className="field">
                      <label>성함</label>
                      <input type="text" placeholder="성함을 입력하세요" />
                    </div>
                    <div className="field">
                      <label>연락처</label>
                      <input type="text" placeholder="연락처를 입력하세요" />
                    </div>
                    <div className="field">
                      <label>주소 입력</label>
                      <input type="text" placeholder="주소를 입력하세요" />
                    </div>
                    <div className="field">
                      <label>대출유형</label>
                      <select defaultValue="아파트 담보대출">
                        <option>아파트 담보대출</option>
                        <option>생활안정자금</option>
                        <option>대환대출</option>
                        <option>사업자대출</option>
                      </select>
                    </div>
                    <button type="button" className="primary-btn">상담 신청하기</button>
                  </form>
                </div>
              </div>
            </section>

            <section id="quick-search" className="section">
              <div className="container">
                <div className="white-panel">
                  <div className="section-center">
                    <div className="section-mini">빠른 시세조회</div>
                    <h2 className="section-title">오늘의 부동산 시세와 예상 한도가 궁금하세요?</h2>
                  </div>

                  <div className="quick-search-box">
                    <div className="quick-search-meta">
                      <span>{catalogLoading ? "전국 단지 마스터 불러오는 중..." : `목록 소스: ${catalogSource || "미확인"}`}</span>
                      <span>{catalogNote}</span>
                    </div>
                    <div className="select-grid select-grid-3">
                      <select value={propertyType} onChange={(e) => { setPropertyType(e.target.value); setSelectedCity(""); setSelectedDistrict(""); setSelectedTown(""); setSelectedApartment(""); setApartmentQuery(""); setSelectedArea(""); }}>
                        <option>아파트</option>
                        <option>오피스텔</option>
                        <option>빌라(연립/다세대)</option>
                      </select>

                      <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setSelectedDistrict(""); setSelectedTown(""); setSelectedApartment(""); setSelectedArea(""); }}>
                        {cities.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>

                      <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedTown(""); setSelectedApartment(""); setSelectedArea(""); }}>
                        {districts.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                    </div>

                    <div className="select-grid select-grid-main">
                      <select value={selectedTown} onChange={(e) => { setSelectedTown(e.target.value); setSelectedApartment(""); setSelectedArea(""); }}>
                        {towns.map((town) => (
                          <option key={town} value={town}>{town}</option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={apartmentQuery}
                        placeholder="단지 선택"
                        onChange={(e) => {
                          setApartmentQuery(e.target.value);
                          setSelectedApartment("");
                          setSelectedArea("");
                          setShowApartmentList(true);
                        }}
                        onFocus={() => setShowApartmentList(true)}
                      />

                      <button
                        type="button"
                        className="search-btn"
                        onClick={handleMarketSearch}
                        disabled={marketLoading}
                      >
                        {marketLoading ? "조회 중..." : "실시간 조회"}
                      </button>
                    </div>

                    {showApartmentList && filteredApartments.length > 0 && (
                      <div className="apartment-dropdown apartment-dropdown-home">
                        {filteredApartments.slice(0, 8).map((name) => (
                          <button
                            key={name}
                            type="button"
                            className={`apartment-option ${selectedApartment === name ? "active" : ""}`}
                            onClick={() => {
                              setSelectedApartment(name);
                              setApartmentQuery(name);
                              setSelectedArea("");
                              setShowApartmentList(false);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="select-grid select-grid-main select-grid-bottom">
                      <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                        {areas.map((area) => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={selectedSummary}
                        readOnly
                        className="selected-summary-input"
                      />

                      <div className="api-status-pill">
                        {marketResult?.source === "reb-openapi" ? "실API 연결" : "API + 예시 fallback"}
                      </div>
                    </div>

                    <div className="selected-text">
                      선택 중: <strong>{selectedSummary}</strong> / <strong>{selectedArea}</strong>
                    </div>

                    {marketError && <div className="api-status error">{marketError}</div>}
                    <div className="api-status">한국부동산원 API 연동 구조이며, 키가 없으면 예시 데이터가 함께 표시됩니다.</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="home-info-strip">
              <div className="container">
                <div className="home-info-grid home-info-grid-3">
                  <div className="home-info-box center-box">
                    <h3>대표 번호</h3>
                    <div className="phone-main">070-8018-7437</div>
                    <div className="phone-sub">빠른 상담 연결</div>
                    <div className="phone-desc">평일 상담 문의 가능</div>
                  </div>

                  <a
                    href="https://open.kakao.com/o/sbaltXmi"
                    target="_blank"
                    rel="noreferrer"
                    className="home-info-box kakao-box kakao-link-box"
                  >
                    <div className="talk-circle">TALK</div>
                    <div className="kakao-title">카카오톡 상담</div>
                    <div className="kakao-id">Ldk1009</div>
                  </a>

                  <div id="calculator" className="home-info-box calculator-home-box">
                    <div className="section-mini">이율 계산기</div>
                    <h3 className="home-calc-title">간편 상환 계산</h3>
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
                  </div>
                </div>
              </div>
            </section>

            <section className="review-section">
              <div className="container review-grid">
                <div className="review-left">
                  <div className="review-title">대출후기</div>
                  <a href="#" className="review-more">더보기 →</a>
                </div>

                <div className="review-list">
                  {[
                    ["후기 제목 예시 1", "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.", "2026.03.20"],
                    ["후기 제목 예시 2", "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.", "2026.03.19"],
                    ["후기 제목 예시 3", "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.", "2026.03.17"],
                  ].map(([title, desc, date]) => (
                    <div key={title} className="review-card">
                      <div className="review-card-top">
                        <div className="review-card-text">
                          <div className="review-card-title">{title}</div>
                          <div className="review-card-desc">{desc}</div>
                        </div>
                        <div className="review-card-date">{date}</div>
                      </div>
                    </div>
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
                        {cities.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                      <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedTown(""); setSelectedApartment(""); setSelectedArea(""); }}>
                        {districts.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                      <select value={selectedTown} onChange={(e) => { setSelectedTown(e.target.value); setSelectedApartment(""); setSelectedArea(""); }}>
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
                  <div className="section-mini light-mini">시세조회 결과 · {marketResult?.source === "reb-openapi" ? "한국부동산원 API" : "예시 데이터 fallback"}</div>
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

                  <div className="desc-card">
                    <div className="section-mini">설명 영역</div>
                    <h3 className="desc-title">선택하신 단지를 기준으로 대출 상담을 도와드립니다.</h3>
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
                      조회하신 단지 정보를 바탕으로 담당자가 빠르게 상담드릴 수 있도록 작성란을 함께 배치한 구조입니다.
                    </p>

                    <form className="form-stack">
                      <input type="text" placeholder="성함" />
                      <input type="text" placeholder="연락처" />
                      <input type="text" value={`${selectedApartment} / ${selectedArea}`} readOnly />
                      <input type="text" value={marketResult?.source === "reb-openapi" ? "한국부동산원 API 조회값 반영" : "API 키 설정 시 실조회 반영"} readOnly />
                      <select defaultValue="희망 상품 선택">
                        <option>희망 상품 선택</option>
                        <option>아파트 담보대출</option>
                        <option>생활안정자금</option>
                        <option>대환대출</option>
                      </select>
                      <textarea rows={4} placeholder="상담 내용을 입력하세요" />
                      <button type="button" className="primary-btn">대출 신청 접수하기</button>
                    </form>
                  </div>

                  <div className="side-card">
                    <div className="section-mini">대표 상담 채널</div>
                    <h3 className="card-title">빠른 연결 안내</h3>
                    <div className="condition-list quick-channel-list">
                      <div className="condition-item">
                        <div className="condition-left">
                          <div className="condition-name">대표 번호</div>
                          <div className="condition-desc">070-8018-7437</div>
                        </div>
                        <div className="condition-badge condition-blue">전화</div>
                      </div>
                      <a href="https://open.kakao.com/o/sbaltXmi" target="_blank" rel="noreferrer" className="condition-item quick-channel-link">
                        <div className="condition-left">
                          <div className="condition-name">카카오톡 아이디</div>
                          <div className="condition-desc">Ldk1009</div>
                        </div>
                        <div className="condition-badge condition-indigo">오픈채팅</div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="faq" className="section faq-section">
          <div className="container faq-wrap">
            <div className="section-center">
              <div className="section-mini">FAQ</div>
              <h2 className="section-title">자주 묻는 질문</h2>
            </div>

            <div className="faq-list">
              <details className="faq-item">
                <summary>시세조회 후 바로 대출 상담도 가능한가요?</summary>
                <p>네. 결과 페이지 오른쪽에 상담 신청란을 함께 배치해 바로 접수할 수 있습니다.</p>
              </details>
              <details className="faq-item">
                <summary>조건 안내는 확정 조건인가요?</summary>
                <p>아니요. 현재는 예시 조건이며 실제 가능 여부와 금리는 상담 후 달라질 수 있습니다.</p>
              </details>
              <details className="faq-item">
                <summary>이율 계산기는 실시간으로 바뀌나요?</summary>
                <p>네. 입력값을 바꾸면 예상 월 상환액과 총 상환 예상액이 즉시 변경됩니다.</p>
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
              <span>상호명 : 시안용 입력칸</span>
              <span>사업자등록번호 : 000-00-00000</span>
              <span>사업장소재지 : 주소 입력칸</span>
              <span>대표자명 : 대표자 입력칸</span>
              <span>광고등록번호 : 0000-0000 / 000-0000-0000</span>
              <span>대부업등록기관 : 등록기관 입력칸</span>
              <span>대부업번호 : 등록번호 입력칸</span>
            </div>

            <div className="legal-copy">© 시안용 업체명. All Rights Reserved.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
