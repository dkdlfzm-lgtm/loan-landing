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
  const [error, setError] = useState("");

  const city = searchParams.get("city") || "";
  const district = searchParams.get("district") || "";
  const town = searchParams.get("town") || "";
  const apartment = searchParams.get("apartment") || "";
  const area = searchParams.get("area") || "";
  const propertyType = searchParams.get("propertyType") || "아파트";

  useEffect(() => {
    setPageMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadMarket() {
      if (!city || !district || !town || !apartment || !area) {
        setError("검색 조건이 부족합니다. 다시 조회해 주세요.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({ city, district, town, apartment, area, propertyType });
        const res = await fetch(`/api/reb-market?${qs.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "시세 정보를 불러오지 못했습니다.");
        }
        setMarketData(data);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "시세 정보를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadMarket();
    return () => {
      alive = false;
    };
  }, [city, district, town, apartment, area, propertyType]);

  const priceResult = marketData?.summary || {
    title: apartment || "조회 결과",
    address: [city, district, town].filter(Boolean).join(" "),
    area: area || "선택 면적",
    floor: "선택 조건 기준",
    tradeDate: "최근 조회 기준",
    latestPrice: loading ? "불러오는 중" : "조회값 없음",
    range: loading ? "불러오는 중" : "조회값 없음",
    averagePrice: loading ? "불러오는 중" : "조회값 없음",
    estimateLimit: loading ? "불러오는 중" : "상담 후 산정",
    description: loading ? "시세 데이터를 조회하고 있습니다." : "조회 결과가 없습니다.",
    trendText: "",
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
              <input type="text" value={[city, district, town].filter(Boolean).join(" ")} readOnly />
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
              <h2 className="result-page-title">{priceResult.title}</h2>
              <p className="result-page-sub">
                {priceResult.address} · {priceResult.area} · 선택 조건 기준
              </p>
              {marketData?.warning ? <p className="result-page-sub" style={{ marginTop: 8 }}>{marketData.warning}</p> : null}
            </div>
            <button type="button" className="white-pill-btn" onClick={() => setShowQuickApply(true)}>
              상담 신청
            </button>
          </div>

          <div className="result-page-grid">
            <div className="result-main-card motion-fade-up is-visible delay-1">
              {error ? (
                <div className="side-card" style={{ marginBottom: 20 }}>
                  <div className="section-mini">조회 오류</div>
                  <h3 className="card-title">시세 정보를 불러오지 못했습니다</h3>
                  <p>{error}</p>
                </div>
              ) : null}

              <div className="info-grid result-info-grid result-info-grid-wide">
                <div className="info-card info-card-emphasis">
                  <div className="info-label">최근 실거래가</div>
                  <div className="info-value">{priceResult.latestPrice}</div>
                  <div className="info-sub">{priceResult.tradeDate}</div>
                </div>
                <div className="info-card">
                  <div className="info-label">최근 거래 범위</div>
                  <div className="info-value">{priceResult.range}</div>
                  <div className="info-sub">{priceResult.trendText || "최근 조회 기준"}</div>
                </div>
                <div className="info-card">
                  <div className="info-label">전용면적 / 평균 시세</div>
                  <div className="info-value">{priceResult.area}</div>
                  <div className="info-sub">{priceResult.averagePrice || "조회값 없음"}</div>
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
                <p style={{ marginBottom: 16 }}>{priceResult.description}</p>

                <div className="condition-list">
                  <div className="condition-item">
                    <div className="condition-left">
                      <div className="condition-name">1금융</div>
                      <div className="condition-desc">시세 70~80% 금리 4%대~</div>
                    </div>
                    <div className="condition-badge condition-blue">안정형</div>
                  </div>

                  <div className="condition-item">
                    <div className="condition-left">
                      <div className="condition-name">저축은행 / 캐피탈</div>
                      <div className="condition-desc">시세 80~90% 금리 5%대~</div>
                    </div>
                    <div className="condition-badge condition-indigo">확장형</div>
                  </div>

                  <div className="condition-item">
                    <div className="condition-left">
                      <div className="condition-name">후순위 / 추가한도</div>
                      <div className="condition-desc">개별 조건 검토 후 한도 산정</div>
                    </div>
                    <div className="condition-badge condition-purple">상담형</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="result-side-col">
              <div id="contact" className="side-card motion-fade-up is-visible delay-2">
                <div className="section-mini">대출 신청 작성란</div>
                <h3 className="card-title">지금 바로 상담받기</h3>

                <form className="form-stack">
                  <input type="text" placeholder="성함" />
                  <input type="text" placeholder="연락처 (예: 010-1234-5678)" />
                  <input type="text" value={`${priceResult.title} / ${priceResult.area}`} readOnly />
                  <select defaultValue="주택담보대출">
                    <option>주택담보대출</option>
                    <option>전세퇴거자금</option>
                    <option>대환대출</option>
                    <option>사업자대출</option>
                    <option>기타</option>
                  </select>
                  <textarea rows={4} defaultValue={`${priceResult.address}\n최근 실거래가: ${priceResult.latestPrice}`} />
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
                  <div className="calc-row"><span>예상 월 납입금</span><strong>{formatNumber(calcResult.monthlyPayment)}원</strong></div>
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


function PriceResultFallback() {
  return (
    <div className="site-wrap">
      <section className="result-page-section">
        <div className="container">
          <div className="result-page-hero motion-fade-up is-visible">
            <div>
              <div className="section-mini light-mini">시세조회 결과</div>
              <h2 className="result-page-title">불러오는 중...</h2>
              <p className="result-page-sub">조회 데이터를 준비하고 있습니다.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PriceResultPage() {
  return (
    <Suspense fallback={<PriceResultFallback />}>
      <PriceResultContent />
    </Suspense>
  );
}
