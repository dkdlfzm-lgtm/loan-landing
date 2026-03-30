"use client";

import { useEffect, useMemo, useState } from "react";

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

const REPAYMENT_RATE_DEFAULTS = { "원리금균등": "5.2", "원금균등": "5.0", "만기일시상환": "5.4" };

export default function PriceResultPage() {
  useScrollReveal();
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("");

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const city = params.get("city") || "경기도";
  const district = params.get("district") || "구리시";
  const town = params.get("town") || "수택동";
  const apartment = params.get("apartment") || "LG원앙";
  const area = params.get("area") || "84.96㎡";

  const priceResult = {
    title: apartment,
    address: `${city} ${district} ${town}`,
    area,
    floor: "101동 12층",
    tradeDate: "2026.03.18",
    latestPrice: "8억 7,500만원",
    range: "8억 3,000만원 ~ 8억 9,000만원",
    estimateLimit: "최대 6억 1,000만원 가능",
    description:
      "선택하신 단지와 면적을 기준으로 최근 시세 흐름과 예상 가능 한도를 확인할 수 있습니다.",
  };

  useEffect(() => {
    setInterestRate(REPAYMENT_RATE_DEFAULTS[repaymentType] || "");
    if (!loanMonths) setLoanMonths("360");
  }, [repaymentType]);

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

  return (
    <div className="site-wrap">
      <section className="result-page-section">
        <div className="container">
          <div className="result-page-topbar">
            <button
              type="button"
              className="back-btn"
              onClick={() => window.history.back()}
            >
              ← 시세조회로 돌아가기
            </button>
          </div>

          <div className="result-page-hero" data-reveal>
            <div className="result-hero-main">
              <div className="section-mini light-mini">시세조회 결과</div>
              <h2 className="result-page-title">{priceResult.title}</h2>
              <p className="result-page-sub">
                {priceResult.address} · {priceResult.area} · {priceResult.floor}
              </p>
            </div>
            <div className="result-hero-side">
              <a href="#contact" className="white-pill-btn">상담 신청</a>
              <div className="result-hero-trade-card">
                <div className="result-hero-trade-label">최근 실거래가</div>
                <div className="result-hero-trade-price">{priceResult.latestPrice}</div>
                <div className="result-hero-trade-meta">거래일 {priceResult.tradeDate} · {priceResult.range}</div>
              </div>
            </div>
          </div>

          <div className="result-page-grid" data-reveal>
            <div className="result-main-card">
              <div className="info-grid result-info-grid result-info-grid-3">
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
                  <div className="info-sub">개인 조건에 따라 달라질 수 있습니다.</div>
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
                <div className="section-mini">선택 정보</div>
                <h3 className="desc-title">조회 단지 정보</h3>

                <div className="tag-wrap">
                  <span>{city}</span>
                  <span>{district}</span>
                  <span>{town}</span>
                  <span>{apartment}</span>
                  <span>{area}</span>
                </div>
              </div>
            </div>

            <div className="result-side-col">
              <div id="contact" className="side-card">
                <div className="section-mini">상담 신청</div>
                <h3 className="card-title">지금 바로 상담 신청</h3>

                <form className="form-stack">
                  <input type="text" placeholder="성함" />
                  <input type="text" placeholder="연락처" />
                  <input type="text" value={`${apartment} / ${area}`} readOnly />
                  <input type="text" value={priceResult.address} readOnly />
                  <select defaultValue="주택담보대출">
                    <option>주택담보대출</option>
                    <option>전세퇴거자금</option>
                    <option>대환대출</option>
                  </select>
                  <textarea rows={4} placeholder="상담 내용을 입력하세요" />
                  <button type="button" className="primary-btn">상담 신청하기</button>
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
                    onChange={(e) => setLoanAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                  <input
                    type="text"
                    placeholder="연 이율(%)"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                </div>

                <div className="two-col">
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

                <div className="calc-box">
                  <div className="calc-label">예상 월 상환액</div>
                  <div className="calc-main">{formatNumber(calcResult.monthlyPayment)}원</div>

                  <div className="calc-grid">
                    <div className="calc-mini">
                      <div className="calc-mini-label">총 예상 이자</div>
                      <div className="calc-mini-value">{formatNumber(calcResult.totalInterest)}원</div>
                    </div>
                    <div className="calc-mini">
                      <div className="calc-mini-label">총 상환 예상액</div>
                      <div className="calc-mini-value">{formatNumber(calcResult.totalPayment)}원</div>
                    </div>
                  </div>
                </div>

                <a href="#contact" className="primary-link-btn">계산 후 상담 신청</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
