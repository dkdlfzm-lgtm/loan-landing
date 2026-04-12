"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./mobile.module.css";
import { DEFAULT_SITE_SETTINGS, cacheSiteSettings, readCachedSiteSettings } from "../../lib/site-settings";
import { mapReviewToApprovalCard } from "../../lib/approval-case-format";

const LOAN_TYPE_OPTIONS = [
  "주택담보대출",
  "전세퇴거자금",
  "경매취하자금",
  "사업자대출",
  "대환대출",
  "매매자금대출",
  "기타",
];

const RATE_BY_TYPE = {
  원리금균등: "5.2",
  원금균등: "5.0",
  만기일시상환: "5.4",
};

const FAQ_ITEMS = [
  {
    q: "주택담보대출 금리비교는 왜 꼭 해야 하나요?",
    a: "금리, 한도, 중도상환수수료, 부대비용에 따라 실제 부담이 달라질 수 있어 여러 조건을 함께 비교하는 것이 중요합니다.",
  },
  {
    q: "한도와 금리는 무엇으로 결정되나요?",
    a: "담보물 평가, LTV·DSR, 신용점수, 기존 부채, 소득 및 상환능력 등에 따라 달라질 수 있습니다.",
  },
  {
    q: "무직자·주부·프리랜서도 상담 가능한가요?",
    a: "가능 여부는 금융사와 담보 조건에 따라 달라질 수 있어, 현재 조건을 기준으로 맞춤 상담을 받아보시는 것이 좋습니다.",
  },
];

function sanitizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function formatDisplayPhone(value) {
  const digits = sanitizePhone(value);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || "";
}

function formatPhoneForCard(value) {
  const display = formatDisplayPhone(value);
  const parts = display.split("-");
  return parts.length === 3 ? `${parts[0]}-${parts[1]}\n${parts[2]}` : display;
}

function MultiLineTitle({ text }) {
  return String(text || "")
    .split("\n")
    .filter(Boolean)
    .map((line, idx) => <span key={`${line}-${idx}`}>{line}</span>);
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

export default function MobileLandingPage() {
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState({ cities: [], districts: [], towns: [], apartments: [], areas: [] });
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedTown, setSelectedTown] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState(RATE_BY_TYPE["원리금균등"]);
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("360");
  const [homeInquiry, setHomeInquiry] = useState({ name: "", phone: "", address: "", loanType: LOAN_TYPE_OPTIONS[0] });
  const [homeInquirySaving, setHomeInquirySaving] = useState(false);
  const [homeInquiryStatus, setHomeInquiryStatus] = useState("");
  const [casePageIndex, setCasePageIndex] = useState(0);

  const consultRef = useRef(null);
  const priceRef = useRef(null);

  const displayPhone = siteSettings.phone || DEFAULT_SITE_SETTINGS.phone;
  const displayKakaoId = siteSettings.kakao_id || DEFAULT_SITE_SETTINGS.kakao_id;
  const displayKakaoUrl = siteSettings.kakao_url || DEFAULT_SITE_SETTINGS.kakao_url;
  const displayLogoUrl = siteSettings.logo_url || DEFAULT_SITE_SETTINGS.logo_url;
  const heroBadge = siteSettings.hero_badge || DEFAULT_SITE_SETTINGS.hero_badge;
  const heroTitle = siteSettings.hero_title || DEFAULT_SITE_SETTINGS.hero_title;

  const [approvalCases, setApprovalCases] = useState([]);
  const casePages = useMemo(() => chunkArray(approvalCases, 3), [approvalCases]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const cached = readCachedSiteSettings();
        if (!cancelled && cached) setSiteSettings(cached);
        const res = await fetch("/api/site-settings", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || data?.ok === false || !data?.settings) throw new Error();
        if (!cancelled) {
          const next = { ...DEFAULT_SITE_SETTINGS, ...data.settings };
          setSiteSettings(next);
          cacheSiteSettings(next);
        }
      } catch {
        if (!cancelled) setSiteSettings(readCachedSiteSettings() || DEFAULT_SITE_SETTINGS);
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadApprovalCases() {
      try {
        const res = await fetch('/api/reviews?limit=30', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error();
        const nextCases = Array.isArray(data.reviews)
          ? data.reviews.map((review) => {
              const card = mapReviewToApprovalCard(review);
              return { id: card.id, name: card.customerName || card.title, lines: [card.currentLoan, card.approvalResult].filter(Boolean) };
            }).filter((item) => item.name)
          : [];
        if (!cancelled) {
          setApprovalCases(nextCases);
          setCasePageIndex(0);
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

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const query = new URLSearchParams({
          propertyType: "아파트",
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          area: selectedArea,
        });
        const res = await fetch(`/api/property-catalog?${query.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error(data?.message || "단지 정보를 불러오지 못했습니다.");
        if (cancelled) return;
        setCatalogOptions(data.options || { cities: [], districts: [], towns: [], apartments: [], areas: [] });
        setSelectedCity(data.query?.city || "");
        setSelectedDistrict(data.query?.district || "");
        setSelectedTown(data.query?.town || "");
        setSelectedApartment(data.query?.apartment || "");
        setSelectedArea(data.query?.area || "");
      } catch (error) {
        if (!cancelled) setCatalogError(error?.message || "단지 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedArea]);

  useEffect(() => {
    if (casePages.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setCasePageIndex((prev) => (prev + 1) % casePages.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [casePages.length]);

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

  function moveTo(ref) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleHomeInquirySubmit(event) {
    event.preventDefault();
    setHomeInquiryStatus("");
    if (!homeInquiry.name.trim() || !homeInquiry.phone.trim()) {
      setHomeInquiryStatus("성함과 연락처를 입력해주세요.");
      return;
    }

    setHomeInquirySaving(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: homeInquiry.name,
          phone: homeInquiry.phone,
          address: homeInquiry.address,
          loanType: homeInquiry.loanType,
          sourcePage: "mobile-home",
          propertyType: "아파트",
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          area: selectedArea,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "상담 신청을 저장하지 못했습니다.");
      setHomeInquiryStatus("상담 신청이 완료되었습니다. 순차적으로 연락드리겠습니다.");
      setHomeInquiry({ name: "", phone: "", address: "", loanType: LOAN_TYPE_OPTIONS[0] });
    } catch (error) {
      setHomeInquiryStatus(error?.message || "상담 신청 중 오류가 발생했습니다.");
    } finally {
      setHomeInquirySaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <div className={styles.logoBox}>
            <img src={displayLogoUrl} alt={siteSettings.company_name || "로고"} className={styles.logoImage} />
          </div>
          <div className={styles.brandText}>
            <strong>{siteSettings.company_name || DEFAULT_SITE_SETTINGS.company_name}</strong>
            <span>{siteSettings.company_subtitle || DEFAULT_SITE_SETTINGS.company_subtitle}</span>
          </div>
        </div>
        <a className={styles.headerCallButton} href={`tel:${sanitizePhone(displayPhone)}`}>전화상담</a>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroBadge}>{heroBadge}</div>
          <h1 className={styles.heroTitle}><MultiLineTitle text={heroTitle} /></h1>

          <div className={styles.quickGrid}>
            <button type="button" className={`${styles.quickCard} ${styles.actionCard} ${styles.primaryCard}`} onClick={() => moveTo(consultRef)}>
              <div className={styles.cardHead}>
                <strong>상담 신청</strong>
              </div>
              <span>이름과 연락처만 남기면 접수 완료</span>
            </button>

            <button type="button" className={`${styles.quickCard} ${styles.actionCard}`} onClick={() => moveTo(priceRef)}>
              <div className={styles.cardHead}>
                <strong>시세조회</strong>
              </div>
              <span>지역과 단지 선택 후 바로 확인</span>
            </button>

            <a className={`${styles.quickCard} ${styles.contactCard}`} href={`tel:${sanitizePhone(displayPhone)}`}>
              <span className={styles.quickLabel}>대표번호</span>
              <div className={styles.iconCircle}>☎</div>
              <strong>전화상담</strong>
              <b>{formatPhoneForCard(displayPhone)}</b>
              <small>클릭 시 바로 연결됩니다</small>
            </a>

            <a className={`${styles.quickCard} ${styles.contactCard} ${styles.kakaoCard}`} href={displayKakaoUrl} target="_blank" rel="noreferrer">
              <span className={styles.quickLabel}>카카오톡</span>
              <div className={`${styles.iconCircle} ${styles.kakaoIcon}`}>TALK</div>
              <strong>카카오톡 상담</strong>
              <b>{displayKakaoId}</b>
              <small>클릭 시 바로 연결됩니다</small>
            </a>
          </div>
        </section>

        <section ref={consultRef} id="mobile-consult" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>상담 신청</span>
            <h2>간단히 남기면 빠르게 연락드립니다</h2>
          </div>
          <form className={styles.formCard} onSubmit={handleHomeInquirySubmit}>
            <label className={styles.field}>
              <span>성함</span>
              <input
                value={homeInquiry.name}
                onChange={(e) => setHomeInquiry((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="성함을 입력해주세요"
              />
            </label>
            <label className={styles.field}>
              <span>연락처</span>
              <input
                value={homeInquiry.phone}
                onChange={(e) => setHomeInquiry((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="연락처를 입력해주세요"
                inputMode="tel"
              />
            </label>
            <label className={styles.field}>
              <span>상담 유형</span>
              <select value={homeInquiry.loanType} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, loanType: e.target.value }))}>
                {LOAN_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>담보 주소</span>
              <input
                value={homeInquiry.address}
                onChange={(e) => setHomeInquiry((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="아파트명 또는 주소를 입력해주세요"
              />
            </label>
            {homeInquiryStatus ? (
              <div className={`${styles.formStatus} ${homeInquiryStatus.includes("완료") ? styles.success : styles.error}`}>
                {homeInquiryStatus}
              </div>
            ) : null}
            <button type="submit" className={styles.submitButton} disabled={homeInquirySaving}>
              {homeInquirySaving ? "접수 중..." : "상담 신청하기"}
            </button>
          </form>
        </section>

        <section ref={priceRef} id="mobile-price" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>시세조회</span>
            <h2>지역과 단지를 선택해 확인해보세요</h2>
          </div>
          <div className={styles.formCard}>
            <label className={styles.field}>
              <span>시/도</span>
              <select value={selectedCity} onChange={(e) => {
                setSelectedCity(e.target.value);
                setSelectedDistrict("");
                setSelectedTown("");
                setSelectedApartment("");
                setSelectedArea("");
              }}>
                <option value="">선택하세요</option>
                {catalogOptions.cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>시/군/구</span>
              <select value={selectedDistrict} onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedTown("");
                setSelectedApartment("");
                setSelectedArea("");
              }}>
                <option value="">선택하세요</option>
                {catalogOptions.districts.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>읍/면/동</span>
              <select value={selectedTown} onChange={(e) => {
                setSelectedTown(e.target.value);
                setSelectedApartment("");
                setSelectedArea("");
              }}>
                <option value="">선택하세요</option>
                {catalogOptions.towns.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>단지 선택</span>
              <select value={selectedApartment} onChange={(e) => {
                setSelectedApartment(e.target.value);
                setSelectedArea("");
              }}>
                <option value="">선택하세요</option>
                {catalogOptions.apartments.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>면적 선택</span>
              <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                <option value="">선택하세요</option>
                {catalogOptions.areas.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            {catalogLoading ? <div className={styles.inlineNote}>단지 정보를 불러오는 중입니다.</div> : null}
            {catalogError ? <div className={`${styles.formStatus} ${styles.error}`}>{catalogError}</div> : null}
          </div>
        </section>

        <section id="mobile-calculator" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>이율계산기</span>
            <h2>대출 조건을 간편하게 계산해보세요</h2>
          </div>
          <div className={styles.formCard}>
            <div className={styles.inlineTwo}>
              <label className={styles.field}>
                <span>대출 금액</span>
                <input
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="예: 300000000"
                />
              </label>
              <label className={styles.field}>
                <span>연 이율(%)</span>
                <input
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="예: 5.2"
                />
              </label>
            </div>
            <div className={styles.inlineTwo}>
              <label className={styles.field}>
                <span>상환 방식</span>
                <select value={repaymentType} onChange={(e) => handleRepaymentTypeChange(e.target.value)}>
                  <option>원리금균등</option>
                  <option>원금균등</option>
                  <option>만기일시상환</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>기간(개월)</span>
                <input
                  value={loanMonths}
                  onChange={(e) => setLoanMonths(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="예: 360"
                />
              </label>
            </div>
            <div className={styles.calcCard}>
              <div className={styles.calcRow}><span>예상 월 상환액</span><strong>{formatNumber(calcResult.monthlyPayment)}원</strong></div>
              <div className={styles.calcRow}><span>총 이자</span><strong>{formatNumber(calcResult.totalInterest)}원</strong></div>
              <div className={styles.calcRow}><span>총 상환금액</span><strong>{formatNumber(calcResult.totalPayment)}원</strong></div>
            </div>
          </div>
        </section>

        <section id="mobile-approval" className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeader}>
              <span>승인사례</span>
              <h2>실제 진행 사례를 확인해보세요</h2>
            </div>
            <button type="button" className={styles.moreButton} onClick={() => setCasePageIndex((prev) => (prev + 1) % casePages.length)}>
              다음
            </button>
          </div>

          <div className={styles.caseViewport}>
            <div
              className={styles.caseTrack}
              style={{ transform: `translateX(-${casePageIndex * 100}%)` }}
            >
              {casePages.map((page, pageIdx) => (
                <div key={`page-${pageIdx}`} className={styles.casePage}>
                  {page.map((item) => (
                    <article key={item.id} className={styles.caseCard}>
                      <div className={styles.caseBadge}>승인</div>
                      <strong className={styles.caseName}>{item.name}</strong>
                      <div className={styles.caseLines}>
                        {item.lines.filter(Boolean).map((line, idx) => <span key={`${item.id}-${idx}`}>{line}</span>)}
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.caseDots}>
            {casePages.map((_, idx) => (
              <button
                key={`dot-${idx}`}
                type="button"
                aria-label={`${idx + 1}번째 승인사례 보기`}
                className={`${styles.caseDot} ${idx === casePageIndex ? styles.caseDotActive : ""}`}
                onClick={() => setCasePageIndex(idx)}
              />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>FAQ</span>
            <h2>자주 묻는 질문</h2>
          </div>
          <div className={styles.faqList}>
            {FAQ_ITEMS.map((item) => (
              <article key={item.q} className={styles.faqItem}>
                <strong>{item.q}</strong>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.legalLines}>
          <div>이자율 : 연6% ~ 연20% 이내 (연체이자율 연 7% ~ 20% 이내, 취급수수료 및 기타 부대비용 없음)</div>
          <div>중개수수료를 요구하거나 받는 것은 불법입니다.</div>
          <div>과도한 빚, 고통의 시작입니다. 대출 시 귀하의 신용등급이 하락할 수 있습니다.</div>
        </div>
        <div className={styles.legalMeta}>
          <span>상호 : 엔드아이에셋대부</span>
          <span>대표자(성명) : 최종원</span>
          <span>대표전화 : 070-8018-7437</span>
          <span>사업자등록번호 : 739-08-03168</span>
          <span>대부중개업 등록번호 : 2025-서울서초-0084</span>
          <span>대부업 등록번호 : 2025-서울서초-0083(대부업)</span>
          <span>사업자주소 : 서울특별시 서초구 서초중앙로 114, 일광빌딩 지하2층 B204호</span>
          <span>등록기관 : 서초구청 일자리경제과 (02-2155-8752)</span>
        </div>
      </footer>

      <div className={styles.bottomBar}>
        <a className={styles.bottomCall} href={`tel:${sanitizePhone(displayPhone)}`}>전화상담</a>
        <a className={styles.bottomKakao} href={displayKakaoUrl} target="_blank" rel="noreferrer">카카오톡 상담</a>
      </div>
    </div>
  );
}
