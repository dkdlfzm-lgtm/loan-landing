"use client";

import { useEffect, useMemo, useState } from "react";

const propertyData = {
  경기도: {
    구리시: {
      수택동: {
        LG원앙: ["59.97㎡", "84.96㎡", "107.28㎡"],
        금호어울림: ["59.88㎡", "84.72㎡"],
        나래아파트: ["84.91㎡"],
      },
      인창동: {
        원일가대라곡: ["59.84㎡", "84.71㎡"],
        인창주공: ["49.98㎡", "59.91㎡"],
      },
    },
    성남시: {
      분당동: {
        샛별마을우방: ["84.91㎡", "101.22㎡"],
      },
    },
  },
  서울특별시: {
    송파구: {
      잠실동: {
        잠실엘스: ["84.88㎡", "119.96㎡"],
        리센츠: ["84.99㎡", "124.22㎡"],
      },
      문정동: {
        올림픽훼밀리타운: ["84.75㎡", "101.98㎡"],
      },
    },
    강남구: {
      대치동: {
        은마아파트: ["76.79㎡", "84.43㎡"],
        래미안대치팰리스: ["84.97㎡", "114.15㎡"],
      },
    },
  },
};

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

export default function LoanLandingPage() {
  const [loanAmount, setLoanAmount] = useState("30000000");
  const [interestRate, setInterestRate] = useState("5.5");
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("36");

  const cities = Object.keys(propertyData);
  const [selectedCity, setSelectedCity] = useState(cities[0]);

  const districts = Object.keys(propertyData[selectedCity] || {});
  const [selectedDistrict, setSelectedDistrict] = useState(districts[0] || "");

  const towns = Object.keys(propertyData[selectedCity]?.[selectedDistrict] || {});
  const [selectedTown, setSelectedTown] = useState(towns[0] || "");

  const apartments = Object.keys(
    propertyData[selectedCity]?.[selectedDistrict]?.[selectedTown] || {}
  );
  const [selectedApartment, setSelectedApartment] = useState(apartments[0] || "");

  const areas =
    propertyData[selectedCity]?.[selectedDistrict]?.[selectedTown]?.[selectedApartment] || [];
  const [selectedArea, setSelectedArea] = useState(areas[0] || "");

  const [currentView, setCurrentView] = useState("home");

  useEffect(() => {
    const nextDistricts = Object.keys(propertyData[selectedCity] || {});
    setSelectedDistrict(nextDistricts[0] || "");
  }, [selectedCity]);

  useEffect(() => {
    const nextTowns = Object.keys(propertyData[selectedCity]?.[selectedDistrict] || {});
    setSelectedTown(nextTowns[0] || "");
  }, [selectedCity, selectedDistrict]);

  useEffect(() => {
    const nextApartments = Object.keys(
      propertyData[selectedCity]?.[selectedDistrict]?.[selectedTown] || {}
    );
    setSelectedApartment(nextApartments[0] || "");
  }, [selectedCity, selectedDistrict, selectedTown]);

  useEffect(() => {
    const nextAreas =
      propertyData[selectedCity]?.[selectedDistrict]?.[selectedTown]?.[selectedApartment] || [];
    setSelectedArea(nextAreas[0] || "");
  }, [selectedCity, selectedDistrict, selectedTown, selectedApartment]);

  const selectedSummary = `${selectedCity} ${selectedDistrict} ${selectedTown} ${selectedApartment}`;

  const priceResult = useMemo(() => {
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
        "선택하신 단지와 면적을 기준으로 최근 시세 흐름과 예상 가능 한도를 확인한 뒤 상담을 도와드리는 결과형 페이지 예시입니다. 실제 운영 시에는 공공 API, 단지/면적 데이터, 내부 심사 기준을 연결해 더 정확하게 고도화할 수 있습니다.",
    };
  }, [selectedApartment, selectedArea, selectedCity, selectedDistrict, selectedTown]);

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

  const faq = [
    {
      q: "시세조회 후 바로 대출 상담도 가능한가요?",
      a: "네. 결과 페이지 오른쪽에 상담 신청란을 함께 배치해 바로 접수할 수 있습니다.",
    },
    {
      q: "조건 안내는 확정 조건인가요?",
      a: "아니요. 현재는 예시 조건이며 실제 가능 여부와 금리는 상담 후 달라질 수 있습니다.",
    },
    {
      q: "이율 계산기는 실시간으로 바뀌나요?",
      a: "네. 입력값을 바꾸면 예상 월 상환액과 총 상환 예상액이 즉시 변경됩니다.",
    },
  ];

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
            <a href="#contact" className="nav-btn">
              상담 신청
            </a>
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
                    <a href="#quick-search" className="btn btn-white">
                      빠른 시세조회
                    </a>
                    <a href="#contact" className="btn btn-outline">
                      무료 상담 신청
                    </a>
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
                    <button type="button" className="primary-btn">
                      상담 신청하기
                    </button>
                  </form>
                </div>
              </div>
            </section>

            <section id="quick-search" className="section">
              <div className="container">
                <div className="white-panel">
                  <div className="section-center">
                    <div className="section-mini">빠른 시세조회</div>
                    <h2 className="section-title">오늘의 아파트 대출이 궁금하세요?</h2>
                  </div>

                  <div className="quick-search-box">
                    <div className="select-grid select-grid-3">
                      <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                        {cities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                      >
                        {districts.map((district) => (
                          <option key={district} value={district}>
                            {district}
                          </option>
                        ))}
                      </select>

                      <select value={selectedTown} onChange={(e) => setSelectedTown(e.target.value)}>
                        {towns.map((town) => (
                          <option key={town} value={town}>
                            {town}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="select-grid select-grid-main">
                      <select
                        value={selectedApartment}
                        onChange={(e) => setSelectedApartment(e.target.value)}
                      >
                        {apartments.map((apartment) => (
                          <option key={apartment} value={apartment}>
                            {apartment}
                          </option>
                        ))}
                      </select>

                      <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                        {areas.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="search-btn"
                        onClick={() => setCurrentView("price-result")}
                      >
                        실시간 조회
                      </button>
                    </div>

                    <div className="selected-text">
                      선택 중: <strong>{selectedSummary}</strong> / <strong>{selectedArea}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="home-info-strip">
              <div className="container">
                <div className="home-info-grid">
                  <div className="home-info-box">
                    <div className="home-info-head">
                      <h3>공지사항</h3>
                      <a href="#">더보기 →</a>
                    </div>

                    <div className="notice-list">
                      {[
                        ["공지사항 1", "2026.03.16"],
                        ["공지사항 2", "2026.03.15"],
                        ["공지사항 3", "2026.03.14"],
                        ["공지사항 4", "2026.03.13"],
                        ["공지사항 5", "2026.03.12"],
                      ].map(([title, date]) => (
                        <div key={title} className="notice-row">
                          <span>{title}</span>
                          <span>{date}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="home-info-box center-box">
                    <h3>무료상담문의</h3>
                    <div className="phone-main">0000-0000</div>
                    <div className="phone-sub">000-0000-0000</div>
                    <div className="phone-desc">상담시간 입력칸</div>
                  </div>

                  <div className="home-info-box kakao-box">
                    <div className="talk-circle">TALK</div>
                    <div className="kakao-title">카카오톡 상담 예시</div>
                    <div className="kakao-id">아이디칸</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="review-section">
              <div className="container review-grid">
                <div className="review-left">
                  <div className="review-title">대출후기</div>
                  <a href="#" className="review-more">
                    더보기 →
                  </a>
                </div>

                <div className="review-list">
                  {[
                    [
                      "후기 제목 예시 1",
                      "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.",
                      "2026.03.20",
                    ],
                    [
                      "후기 제목 예시 2",
                      "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.",
                      "2026.03.19",
                    ],
                    [
                      "후기 제목 예시 3",
                      "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.",
                      "2026.03.17",
                    ],
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
                <button
                  type="button"
                  className="back-btn"
                  onClick={() => setCurrentView("home")}
                >
                  ← 시세조회로 돌아가기
                </button>
              </div>

              <div className="result-page-hero">
                <div>
                  <div className="section-mini light-mini">시세조회 결과</div>
                  <h2 className="result-page-title">{priceResult.title}</h2>
                  <p className="result-page-sub">
                    {priceResult.address} · {priceResult.area} · {priceResult.floor}
                  </p>
                </div>
                <a href="#contact" className="white-pill-btn">
                  상담 신청
                </a>
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
                    <h3 className="desc-title">
                      선택하신 단지를 기준으로 대출 상담을 도와드립니다.
                    </h3>
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
                      조회하신 단지 정보를 바탕으로 담당자가 빠르게 상담드릴 수 있도록
                      작성란을 함께 배치한 구조입니다.
                    </p>

                    <form className="form-stack">
                      <input type="text" placeholder="성함" />
                      <input type="text" placeholder="연락처" />
                      <input type="text" value={`${selectedApartment} / ${selectedArea}`} readOnly />
                      <select defaultValue="희망 상품 선택">
                        <option>희망 상품 선택</option>
                        <option>아파트 담보대출</option>
                        <option>생활안정자금</option>
                        <option>대환대출</option>
                      </select>
                      <textarea rows={4} placeholder="상담 내용을 입력하세요" />
                      <button type="button" className="primary-btn">
                        대출 신청 접수하기
                      </button>
                    </form>
                  </div>

                  <div id="calculator" className="side-card">
                    <div className="section-mini">이율 계산기</div>
                    <h3 className="card-title">예상 상환 금액 계산</h3>

                    <div className="two-col">
                      <input
                        type="text"
                        placeholder="대출 금액"
                        value={loanAmount}
                        onChange={(e) =>
                          setLoanAmount(e.target.value.replace(/[^0-9]/g, ""))
                        }
                      />
                      <input
                        type="text"
                        placeholder="연 이율(%)"
                        value={interestRate}
                        onChange={(e) =>
                          setInterestRate(e.target.value.replace(/[^0-9.]/g, ""))
                        }
                      />
                    </div>

                    <div className="two-col">
                      <select
                        value={repaymentType}
                        onChange={(e) => setRepaymentType(e.target.value)}
                      >
                        <option>원리금균등</option>
                        <option>원금균등</option>
                        <option>만기일시상환</option>
                      </select>
                      <input
                        type="text"
                        placeholder="기간(개월)"
                        value={loanMonths}
                        onChange={(e) =>
                          setLoanMonths(e.target.value.replace(/[^0-9]/g, ""))
                        }
                      />
                    </div>

                    <div className="calc-box">
                      <div className="calc-label">예상 월 상환액</div>
                      <div className="calc-main">{formatNumber(calcResult.monthlyPayment)}원</div>

                      <div className="calc-grid">
                        <div className="calc-mini">
                          <div className="calc-mini-label">총 예상 이자</div>
                          <div className="calc-mini-value">
                            {formatNumber(calcResult.totalInterest)}원
                          </div>
                        </div>
                        <div className="calc-mini">
                          <div className="calc-mini-label">총 상환 예상액</div>
                          <div className="calc-mini-value">
                            {formatNumber(calcResult.totalPayment)}원
                          </div>
                        </div>
                      </div>
                    </div>

                    <a href="#contact" className="primary-link-btn">
                      계산 후 상담 신청
                    </a>
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
              {faq.map((item) => (
                <details key={item.q} className="faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
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
