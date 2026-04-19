"use client";

import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_SUMMARY = {
  title: "조회 단지",
  address: "주소 정보 없음",
  area: "선택 면적",
  tradeDate: "최근 조회 기준",
  latestPrice: "조회 중",
  range: "조회 중",
  averagePrice: "조회 중",
  estimateLimit: "상담 후 산정",
  description: "실거래 데이터를 불러오는 중입니다.",
  trendText: "시세 확인 중",
};

function buildConditionRows(summary) {
  const latest = summary?.latestPrice || "조회값 없음";
  const limit = summary?.estimateLimit || "상담 후 산정";
  const average = summary?.averagePrice || summary?.range || "조회값 없음";

  return [
    {
      name: "최근 실거래 기준",
      desc: `${latest} · ${summary?.tradeDate || "최근 기준"}`,
      badge: "실거래",
      badgeClass: "condition-blue",
    },
    {
      name: "평균 시세 참고",
      desc: `${average} · ${summary?.trendText || "최근 흐름"}`,
      badge: "참고형",
      badgeClass: "condition-indigo",
    },
    {
      name: "예상 가능 한도",
      desc: `${limit} · 상담 후 세부조건 반영`,
      badge: "상담형",
      badgeClass: "condition-purple",
    },
  ];
}

export default function PriceResultPage() {
  const searchParams = useSearchParams();
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("");
  const [pageMounted, setPageMounted] = useState(false);
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");
  const [loadError, setLoadError] = useState("");
  const [resultSource, setResultSource] = useState("");
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);

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
    let cancelled = false;

    async function fetchMarket() {
      if (!city || !district || !town || !apartment || !area) {
        setLoading(false);
        setLoadError("조회 조건이 부족합니다. 시세조회 페이지에서 지역과 단지를 다시 선택해 주세요.");
        setSummary({
          ...DEFAULT_SUMMARY,
          title: apartment || "조회 단지",
          address: [city, district, town].filter(Boolean).join(" ") || "주소 정보 없음",
          area: area || "선택 면적",
          description: "조회 조건을 다시 선택해 주세요.",
        });
        return;
      }

      setLoading(true);
      setLoadError("");
      setWarning("");

      try {
        const qs = new URLSearchParams({
          propertyType,
          city,
          district,
          town,
          apartment,
          area,
        });
        const res = await fetch(`/api/reb-market?${qs.toString()}`, { cache: "no-store" });
        const payload = await res.json();

        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.message || "시세 데이터를 불러오지 못했습니다.");
        }

        if (cancelled) return;

        setSummary({
          ...DEFAULT_SUMMARY,
          ...payload.summary,
          title: payload.summary?.title || apartment,
          address:
            payload.summary?.address || [city, district, town].filter(Boolean).join(" "),
          area: payload.summary?.area || area,
        });
        setWarning(payload?.warning || "");
        setResultSource(payload?.source || "");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error?.message || "시세 데이터를 불러오지 못했습니다.");
        setSummary({
          ...DEFAULT_SUMMARY,
          title: apartment || "조회 단지",
          address: [city, district, town].filter(Boolean).join(" ") || "주소 정보 없음",
          area: area || "선택 면적",
          latestPrice: "조회 실패",
          range: "조회 실패",
          averagePrice: "조회 실패",
          description: "실거래 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
          trendText: "조회 실패",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMarket();
    return () => {
      cancelled = true;
    };
  }, [propertyType, city, district, town, apartment, area]);

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

  const conditionRows = buildConditionRows(summary);
  const heroSub = [summary.address, summary.area, "선택 조건 기준"].filter(Boolean).join(" · ");

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
              <input type="text" placeholder="주소를 입력하세요" defaultValue={summary.address} />
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
              <h2 className="result-page-title">{summary.title}</h2>
              <p className="result-page-sub">{heroSub}</p>
            </div>
            <button type="button" className="white-pill-btn" onClick={() => setShowQuickApply(true)}>
              상담 신청
            </button>
          </div>

          <div className="result-page-grid">
            <div className="result-main-card motion-fade-up is-visible delay-1">
              {(loading || warning || loadError || resultSource) && (
                <div className="info-card" style={{ marginBottom: 16 }}>
                  <div className="info-label">조회 상태</div>
                  <div className="info-sub" style={{ whiteSpace: "pre-wrap" }}>
                    {loading
                      ? "실거래 데이터를 조회 중입니다."
                      : loadError
                      ? loadError
                      : warning || "실거래 캐시 기준으로 조회되었습니다."}
                  </div>
                  {resultSource ? <div className="info-sub">데이터 출처: {resultSource}</div> : null}
                </div>
              )}

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
                  <div className="info-label">전용면적 / 평균 시세</div>
                  <div className="info-value">{summary.area}</div>
                  <div className="info-sub">{summary.averagePrice || "조회값 없음"}</div>
                </div>
                <div className="info-card">
                  <div className="info-label">예상 가능 한도</div>
                  <div className="info-value">{summary.estimateLimit}</div>
                  <div className="info-sub">상담 후 세부조건 반영</div>
                </div>
              </div>

              <div className="condition-card motion-fade-up is-visible delay-2">
                <div className="section-mini">조건 안내</div>
                <h3 className="desc-title">시세 정보 기준 추천 조건</h3>

                <div className="condition-list">
                  {conditionRows.map((item) => (
                    <div className="condition-item" key={`${item.name}-${item.badge}`}>
                      <div className="condition-left">
                        <div className="condition-name">{item.name}</div>
                        <div className="condition-desc">{item.desc}</div>
                      </div>
                      <div className={`condition-badge ${item.badgeClass}`}>{item.badge}</div>
                    </div>
                  ))}
                </div>

                <div className="info-sub" style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
                  {summary.description}
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
                  <textarea rows={4} placeholder="상담 내용을 입력하세요" defaultValue={`${summary.address} / ${summary.latestPrice}`} />
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
