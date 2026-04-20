"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

const RATE_BY_TYPE = {
  원리금균등: "5.2",
  원금균등: "5.0",
  만기일시상환: "5.4",
};

function PriceResultContent() {
  const searchParams = useSearchParams();
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("");
  const [pageMounted, setPageMounted] = useState(false);
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const propertyType = searchParams.get("propertyType") || "아파트";
  const city = searchParams.get("city") || "";
  const district = searchParams.get("district") || "";
  const town = searchParams.get("town") || "";
  const apartment = searchParams.get("apartment") || "";
  const area = searchParams.get("area") || "";

  useEffect(() => {
    setPageMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!city || !district || !town || !apartment || !area) {
        setErrorText("조회에 필요한 조건이 부족합니다. 시세조회 화면에서 다시 선택해 주세요.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const qs = new URLSearchParams({ propertyType, city, district, town, apartment, area });
        const res = await fetch(`/api/reb-market?${qs.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json?.ok === false) {
          setErrorText(json?.message || "시세 조회 중 오류가 발생했습니다.");
          setMarketData(null);
        } else {
          setMarketData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorText(err?.message || "시세 조회 중 오류가 발생했습니다.");
          setMarketData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [propertyType, city, district, town, apartment, area]);

  const summary = marketData?.summary || {
    title: apartment || "조회값 없음",
    address: [city, district, town].filter(Boolean).join(" "),
    area: area || "선택 면적",
    tradeDate: "조회 기준",
    latestPrice: "조회값 없음",
    range: "조회값 없음",
    averagePrice: "조회값 없음",
    estimateLimit: "상담 후 산정",
    description: errorText || "조회값 없음",
    trendText: "실거래 데이터 없음",
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
              <input type="text" defaultValue={summary.address} />
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
            <button type="button" className="back-btn" onClick={() => window.history.back()}>
              ← 시세조회로 돌아가기
            </button>
          </div>

          <div className={`result-page-hero motion-fade-up${pageMounted ? " is-visible" : ""}`}>
            <div>
              <div className="section-mini light-mini">시세조회 결과</div>
              <h2 className="result-page-title">{summary.title}</h2>
              <p className="result-page-sub">
                {summary.address} · {summary.area} · {propertyType}
              </p>
            </div>
            <button type="button" className="white-pill-btn" onClick={() => setShowQuickApply(true)}>
              상담 신청
            </button>
          </div>

          <div className="result-page-grid">
            <div className="result-main-card motion-fade-up is-visible delay-1">
              {loading ? (
                <div className="condition-card"><h3 className="desc-title">실거래 데이터를 불러오는 중입니다...</h3></div>
              ) : null}
              {!loading && errorText ? (
                <div className="condition-card"><h3 className="desc-title">{errorText}</h3></div>
              ) : null}
              {!loading && marketData?.warning ? (
                <div className="condition-card"><h3 className="desc-title">참고 안내</h3><p>{marketData.warning}</p></div>
              ) : null}

              <div className="info-grid result-info-grid result-info-grid-wide">
                <div className="info-card info-card-emphasis">
                  <div className="info-label">최근 실거래가</div>
                  <div className="info-value">{summary.latestPrice}</div>
                  <div className="info-sub">{summary.tradeDate}</div>
                </div>
                <div className="info-card">
                  <div className="info-label">최근 거래 범위</div>
                  <div className="info-value">{summary.range}</div>
                  <div className="info-sub">{summary.trendText || "최근 조회 기준"}</div>
                </div>
                <div className="info-card">
                  <div className="info-label">평균 실거래가</div>
                  <div className="info-value">{summary.averagePrice}</div>
                  <div className="info-sub">수집된 거래 기준</div>
                </div>
                <div className="info-card">
                  <div className="info-label">예상 가능 한도</div>
                  <div className="info-value">{summary.estimateLimit}</div>
                  <div className="info-sub">상담 후 세부조건 반영</div>
                </div>
              </div>

              <div className="condition-card motion-fade-up is-visible delay-2">
                <div className="section-mini">조건 안내</div>
                <h3 className="desc-title">조회 기준 설명</h3>
                <p style={{ marginTop: 12, lineHeight: 1.7 }}>{summary.description}</p>

                <div className="condition-list" style={{ marginTop: 20 }}>
                  <div className="condition-item">
                    <div className="condition-left">
                      <div className="condition-name">1금융</div>
                      <div className="condition-desc">시세 70~80% / 금리 4%대부터</div>
                    </div>
                    <div className="condition-badge condition-blue">안정형</div>
                  </div>
                  <div className="condition-item">
                    <div className="condition-left">
                      <div className="condition-name">저축은행·캐피탈</div>
                      <div className="condition-desc">추가 한도 가능 / 조건별 상이</div>
                    </div>
                    <div className="condition-badge condition-indigo">확장형</div>
                  </div>
                  <div className="condition-item">
                    <div className="condition-left">
                      <div className="condition-name">맞춤 상담</div>
                      <div className="condition-desc">소득·기존 대출·LTV에 따라 달라집니다.</div>
                    </div>
                    <div className="condition-badge condition-purple">상담형</div>
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
                  <input type="text" value={`${summary.title} / ${summary.area}`} readOnly />
                  <select defaultValue="주택담보대출">
                    <option>주택담보대출</option>
                    <option>전세퇴거자금</option>
                    <option>대환대출</option>
                    <option>사업자대출</option>
                    <option>기타</option>
                  </select>
                  <textarea rows={4} defaultValue={`${summary.address} ${summary.title} ${summary.area}`} />
                  <button type="button" className="primary-btn">대출 신청 접수하기</button>
                </form>
              </div>

              <div id="calculator" className="side-card motion-fade-up is-visible delay-3">
                <div className="section-mini">이율 계산기</div>
                <h3 className="card-title">간편 이율계산기</h3>
                <div className="two-col">
                  <input type="text" placeholder="대출 금액" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value.replace(/[^0-9]/g, ""))} />
                  <input type="text" placeholder="연 이율(%)" value={interestRate} onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9.]/g, ""))} />
                </div>
                <div className="two-col">
                  <select value={repaymentType} onChange={(e) => handleRepaymentTypeChange(e.target.value)}>
                    <option>원리금균등</option>
                    <option>원금균등</option>
                    <option>만기일시상환</option>
                  </select>
                  <input type="text" placeholder="기간(개월)" value={loanMonths} onChange={(e) => setLoanMonths(e.target.value.replace(/[^0-9]/g, ""))} />
                </div>
                <div className="calc-box calc-box-hero">
                  <div className="calc-row"><span>예상 월 납입액</span><strong>{formatNumber(calcResult.monthlyPayment)}원</strong></div>
                  <div className="calc-row"><span>총 이자</span><strong>{formatNumber(calcResult.totalInterest)}원</strong></div>
                  <div className="calc-row"><span>총 상환액</span><strong>{formatNumber(calcResult.totalPayment)}원</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PriceResultPage() {
  return (
    <Suspense fallback={<div className="site-wrap"><section className="result-page-section"><div className="container"><div className="condition-card"><h3 className="desc-title">시세조회 결과를 준비하고 있습니다...</h3></div></div></section></div>}>
      <PriceResultContent />
    </Suspense>
  );
}
