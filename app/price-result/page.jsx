"use client";

import { useEffect, useMemo, useState } from "react";

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

const RATE_BY_TYPE = {
  원리금균등: "5.2",
  원금균등: "5.0",
  만기일시상환: "5.4",
};

export default function PriceResultPage() {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("");
  const [pageMounted, setPageMounted] = useState(false);
  const [showQuickApply, setShowQuickApply] = useState(false);

  useEffect(() => {
    setPageMounted(true);
  }, []);

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const city = params.get("city") || "경기도";
  const district = params.get("district") || "구리시";
  const town = params.get("town") || "인창동";
  const apartment = params.get("apartment") || "구리 더샵 그린포레 2단지";
  const area = params.get("area") || "84.98㎡";

  const priceResult = {
    title: apartment,
    address: `${city} ${district} ${town}`,
    area,
    floor: "선택 조건 기준",
    tradeDate: "최근 조회 기준",
    latestPrice: "9억 9,021만원",
    range: "9억 4,500만원 ~ 10억 1,843만원",
    estimateLimit: "최대 7억 1,295만원 가능",
  };

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

  function handleRepaymentTypeChange(nextType) {
    setRepaymentType(nextType);
    setInterestRate(RATE_BY_TYPE[nextType] || "");
    setLoanMonths((prev) => (prev && String(prev).trim() !== "" ? prev : "360"));
  }

  return (
    <div className="site-wrap">
      {showQuickApply && (
        <div className="quick-apply-sheet-backdrop" onClick={() => setShowQuickApply(false)}>
          <div className="quick-apply-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="section-mini">빠른 상담 신청</div>
            <h3 className="card-title">빠른 상담 접수</h3>
            <form className="form-stack">
              <label className="input-label">성함</label>
              <input type="text" placeholder="성함을 입력하세요" />
              <label className="input-label">연락처</label>
              <input type="text" placeholder="연락처를 입력하세요" />
              <label className="input-label">주소 입력</label>
              <input type="text" placeholder="주소를 입력하세요" />
              <label className="input-label">대출유형</label>
              <select defaultValue="주택담보대출">
                <option>주택담보대출</option>
                <option>전세퇴거자금</option>
                <option>대환대출</option>
                <option>사업자대출</option>
                <option>기타</option>
              </select>
              <button type="button" className="primary-btn">상담 신청하기</button>
            </form>
          </div>
        </div>
      )}

      <section className="result-page-section">
        <div className="container">
          <div className="result-page-topbar motion-fade-up">
            <button
              type="button"
              className="back-btn"
              onClick={() => window.history.back()}
            >
              ← 시세조회로 돌아가기
            </button>
          </div>

          <div className={`result-page-hero motion-fade-up${pageMounted ? " is-visible" : ""}`}>
            <div>
              <div className="section-mini light-mini">시세조회 결과</div>
              <h2 className="result-page-title">{priceResult.title}</h2>
              <p className="result-page-sub">
                {priceResult.address} · {priceResult.area} · {priceResult.floor}
              </p>
            </div>
            <button type="button" className="white-pill-btn" onClick={() => setShowQuickApply(true)}>
              상담 신청
            </button>
          </div>

          <div className="result-page-grid">
            <div className="result-main-card motion-fade-up is-visible delay-1">
              <div className="info-grid result-info-grid result-info-grid-wide">
                <div className="info-card info-card-emphasis">
                  <div className="info-label">최근 실거래가</div>
                  <div className="info-value">{priceResult.latestPrice}</div>
                  <div className="info-sub">{priceResult.tradeDate}</div>
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

              <div className="condition-card motion-fade-up is-visible delay-2">
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
              <div id="contact" className="side-card motion-fade-up is-visible delay-2">
                <div className="section-mini">대출 신청 작성란</div>
                <h3 className="card-title">지금 바로 상담 신청</h3>

                <form className="form-stack">
                  <input type="text" placeholder="성함" />
                  <input type="text" placeholder="연락처" />
                  <input type="text" value={`${apartment} / ${area}`} readOnly />
                  <select defaultValue="주택담보대출">
                    <option>주택담보대출</option>
                    <option>전세퇴거자금</option>
                    <option>대환대출</option>
                    <option>사업자대출</option>
                    <option>기타</option>
                  </select>
                  <textarea rows={4} placeholder="상담 내용을 입력하세요" />
                  <button type="button" className="primary-btn">대출 신청 접수하기</button>
                </form>
              </div>

              <div id="calculator" className="side-card motion-fade-up is-visible delay-3">
                <div className="section-mini">이율 계산기</div>
                <h3 className="card-title">간편 이율계산기</h3>

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
                  <select value={repaymentType} onChange={(e) => handleRepaymentTypeChange(e.target.value)}>
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

                <div className="calc-box calc-box-hero">
                  <div className="calc-label">예상 월 상환액</div>
                  <div className="calc-main">{formatNumber(calcResult.monthlyPayment)}원</div>
                </div>

                <div className="calc-grid calc-grid-under">
                  <div className="calc-mini">
                    <div className="calc-mini-label">총 예상 이자</div>
                    <div className="calc-mini-value">{formatNumber(calcResult.totalInterest)}원</div>
                  </div>
                  <div className="calc-mini">
                    <div className="calc-mini-label">총 상환 예상액</div>
                    <div className="calc-mini-value">{formatNumber(calcResult.totalPayment)}원</div>
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
