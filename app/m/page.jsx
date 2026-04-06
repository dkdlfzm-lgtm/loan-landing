"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./mobile.module.css";
import { DEFAULT_SITE_SETTINGS, cacheSiteSettings, readCachedSiteSettings } from "../../lib/site-settings";

const loanTypeOptions = [
  "주택담보대출",
  "전세퇴거자금",
  "경매취하자금",
  "사업자대출",
  "대환대출",
  "매매자금대출",
  "기타",
];

const faqItems = [
  {
    q: "주택담보대출은 어디서부터 준비하면 되나요?",
    a: "보유 중인 주택 정보와 현재 필요한 자금 목적만 정리해주시면 됩니다. 가능 여부와 진행 방향은 상담을 통해 순서대로 안내해드립니다.",
  },
  {
    q: "시세조회 후 바로 상담도 가능한가요?",
    a: "가능합니다. 시세조회 후 예상 가능한 범위를 확인하고, 전화 또는 카카오톡으로 바로 이어서 상담받으실 수 있습니다.",
  },
  {
    q: "대환대출이나 전세퇴거자금도 상담 가능한가요?",
    a: "네. 대환대출, 전세퇴거자금, 사업자대출 등 현재 상황에 맞는 방향으로 함께 확인해드립니다.",
  },
  {
    q: "상담 신청하면 어떻게 진행되나요?",
    a: "성함과 연락처를 남겨주시면 확인 후 순차적으로 연락드리며, 필요한 내용만 간단하게 안내해드립니다.",
  },
];

function formatPhoneHref(phone) {
  return `tel:${String(phone || "").replace(/[^0-9+]/g, "")}`;
}

function statusClass(message, stylesRef) {
  if (!message) return "";
  return message.includes("완료") || message.includes("접수") ? stylesRef.statusSuccess : stylesRef.statusError;
}

export default function MobileLandingPage() {
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [approvalCases, setApprovalCases] = useState([]);
  const [currentView, setCurrentView] = useState("home");

  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedTown, setSelectedTown] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [catalogOptions, setCatalogOptions] = useState({ cities: [], districts: [], towns: [], apartments: [], areas: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogNote, setCatalogNote] = useState("");

  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketResult, setMarketResult] = useState(null);

  const [homeInquiry, setHomeInquiry] = useState({ name: "", phone: "", address: "", loanType: loanTypeOptions[0] });
  const [homeInquirySaving, setHomeInquirySaving] = useState(false);
  const [homeInquiryStatus, setHomeInquiryStatus] = useState("");

  const [resultInquiry, setResultInquiry] = useState({ name: "", phone: "", memo: "", loanType: loanTypeOptions[0] });
  const [resultInquirySaving, setResultInquirySaving] = useState(false);
  const [resultInquiryStatus, setResultInquiryStatus] = useState("");

  const displayPhone = siteSettings.phone || DEFAULT_SITE_SETTINGS.phone;
  const displayKakaoId = siteSettings.kakao_id || DEFAULT_SITE_SETTINGS.kakao_id;
  const displayKakaoUrl = siteSettings.kakao_url || DEFAULT_SITE_SETTINGS.kakao_url;
  const displayLogoUrl = siteSettings.logo_url || DEFAULT_SITE_SETTINGS.logo_url;
  const companyName = siteSettings.company_name || DEFAULT_SITE_SETTINGS.company_name;
  const companySub = siteSettings.company_subtitle || DEFAULT_SITE_SETTINGS.company_subtitle;

  useEffect(() => {
    let cancelled = false;

    async function loadSiteSettings() {
      try {
        const cached = readCachedSiteSettings();
        if (!cancelled && cached) setSiteSettings(cached);

        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false || !data?.settings) throw new Error("사이트 설정을 불러오지 못했습니다.");

        if (!cancelled) {
          const normalized = { ...DEFAULT_SITE_SETTINGS, ...data.settings };
          setSiteSettings(normalized);
          cacheSiteSettings(normalized);
        }
      } catch {
        if (!cancelled) setSiteSettings(readCachedSiteSettings() || DEFAULT_SITE_SETTINGS);
      }
    }

    async function loadApprovalCases() {
      try {
        const response = await fetch("/api/reviews?limit=6", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error("승인사례를 불러오지 못했습니다.");
        if (!cancelled) setApprovalCases(Array.isArray(data.reviews) ? data.reviews : []);
      } catch {
        if (!cancelled) setApprovalCases([]);
      }
    }

    loadSiteSettings();
    loadApprovalCases();

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
          propertyType: "아파트",
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          area: selectedArea,
        });

        const response = await fetch(`/api/property-catalog?${query.toString()}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.message || "단지 목록을 불러오지 못했습니다.");

        if (cancelled) return;
        setCatalogOptions(data.options || { cities: [], districts: [], towns: [], apartments: [], areas: [] });
        setCatalogNote(data.note || "");
        setSelectedCity(data.query?.city || "");
        setSelectedDistrict(data.query?.district || "");
        setSelectedTown(data.query?.town || "");
        setSelectedApartment(data.query?.apartment || "");
        setSelectedArea(data.query?.area || "");
      } catch (error) {
        if (!cancelled) setMarketError(error?.message || "단지 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedArea]);

  const resultSummary = useMemo(() => {
    const summary = marketResult?.summary;
    if (summary) {
      return {
        title: summary.title || selectedApartment || "선택 단지",
        address: summary.address || [selectedCity, selectedDistrict, selectedTown].filter(Boolean).join(" "),
        area: summary.area || selectedArea || "면적 선택 필요",
        latestPrice: summary.latestPrice || "조회값 없음",
        range: summary.range || "조회값 없음",
        estimateLimit: summary.estimateLimit || "상담 후 산정",
        tradeDate: summary.tradeDate || "최신 기준",
      };
    }
    return {
      title: selectedApartment || "선택 단지",
      address: [selectedCity, selectedDistrict, selectedTown].filter(Boolean).join(" "),
      area: selectedArea || "면적 선택 필요",
      latestPrice: "조회값 없음",
      range: "조회값 없음",
      estimateLimit: "상담 후 산정",
      tradeDate: "최신 기준",
    };
  }, [marketResult, selectedApartment, selectedArea, selectedCity, selectedDistrict, selectedTown]);

  async function handleMarketSearch() {
    if (!selectedCity || !selectedDistrict || !selectedTown || !selectedApartment || !selectedArea) {
      setMarketError("지역, 단지, 면적을 모두 선택해주세요.");
      return;
    }
    setMarketLoading(true);
    setMarketError("");
    try {
      const query = new URLSearchParams({
        propertyType: "아파트",
        city: selectedCity,
        district: selectedDistrict,
        town: selectedTown,
        apartment: selectedApartment,
        area: selectedArea,
      });
      const response = await fetch(`/api/reb-market?${query.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "시세 정보를 불러오지 못했습니다.");
      setMarketResult(data);
      setCurrentView("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMarketError(error?.message || "시세 정보를 불러오지 못했습니다.");
      setCurrentView("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setMarketLoading(false);
    }
  }

  async function submitHomeInquiry(e) {
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
        body: JSON.stringify({ ...homeInquiry, sourcePage: "mobile-home" }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "상담접수를 저장하지 못했습니다.");
      setHomeInquiryStatus("상담 신청이 접수되었습니다. 확인 후 빠르게 연락드리겠습니다.");
      setHomeInquiry({ name: "", phone: "", address: "", loanType: loanTypeOptions[0] });
    } catch (error) {
      setHomeInquiryStatus(error?.message || "상담접수를 저장하지 못했습니다.");
    } finally {
      setHomeInquirySaving(false);
    }
  }

  async function submitResultInquiry(e) {
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
          address: [selectedCity, selectedDistrict, selectedTown, selectedApartment].filter(Boolean).join(" "),
          propertyType: "아파트",
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          area: selectedArea,
          sourcePage: "mobile-result",
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "상담 신청을 저장하지 못했습니다.");
      setResultInquiryStatus("상담 신청이 접수되었습니다. 확인 후 빠르게 연락드리겠습니다.");
      setResultInquiry({ name: "", phone: "", memo: "", loanType: loanTypeOptions[0] });
    } catch (error) {
      setResultInquiryStatus(error?.message || "상담 신청을 저장하지 못했습니다.");
    } finally {
      setResultInquirySaving(false);
    }
  }

  const cities = catalogOptions.cities || [];
  const districts = catalogOptions.districts || [];
  const towns = catalogOptions.towns || [];
  const apartments = catalogOptions.apartments || [];
  const areas = catalogOptions.areas || [];

  if (currentView === "result") {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button type="button" className={styles.headerBack} onClick={() => setCurrentView("home")}>←</button>
          <div className={styles.brandWrapCompact}>
            <div className={styles.brandName}>{companyName}</div>
            <div className={styles.brandSubCompact}>시세조회 결과 확인</div>
          </div>
          <a href={formatPhoneHref(displayPhone)} className={styles.headerCallMini}>전화</a>
        </header>

        <section className={styles.resultHero}>
          <div className={styles.resultBadge}>조회 결과</div>
          <h1 className={styles.resultTitle}>{resultSummary.title}</h1>
          <p className={styles.resultAddress}>{resultSummary.address || "선택한 주소 기준"}</p>
          <div className={styles.resultMeta}>전용/공급면적 {resultSummary.area} · 기준일 {resultSummary.tradeDate}</div>
        </section>

        <section className={styles.resultCard}>
          <div className={styles.resultRow}><span>최근 시세</span><strong>{resultSummary.latestPrice}</strong></div>
          <div className={styles.resultRow}><span>조회 범위</span><strong>{resultSummary.range}</strong></div>
          <div className={`${styles.resultRow} ${styles.resultRowAccent}`}><span>예상 상담 기준</span><strong>{resultSummary.estimateLimit}</strong></div>
          {marketError ? <div className={`${styles.status} ${styles.statusError}`}>{marketError}</div> : null}
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span>빠른 상담 신청</span>
            <h2>조회한 내용 기준으로 상담받아보세요</h2>
          </div>
          <form className={styles.formStack} onSubmit={submitResultInquiry}>
            <label className={styles.fieldLabel}>
              <span>성함</span>
              <input type="text" placeholder="성함을 입력해주세요" value={resultInquiry.name} onChange={(e) => setResultInquiry((prev) => ({ ...prev, name: e.target.value }))} />
            </label>
            <label className={styles.fieldLabel}>
              <span>연락처</span>
              <input type="text" placeholder="연락처를 입력해주세요" value={resultInquiry.phone} onChange={(e) => setResultInquiry((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label className={styles.fieldLabel}>
              <span>상담 유형</span>
              <select value={resultInquiry.loanType} onChange={(e) => setResultInquiry((prev) => ({ ...prev, loanType: e.target.value }))}>
                {loanTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              <span>남기실 말씀</span>
              <textarea rows={4} placeholder="궁금하신 내용을 남겨주세요" value={resultInquiry.memo} onChange={(e) => setResultInquiry((prev) => ({ ...prev, memo: e.target.value }))} />
            </label>
            {resultInquiryStatus ? <div className={`${styles.status} ${statusClass(resultInquiryStatus, styles)}`}>{resultInquiryStatus}</div> : null}
            <button type="submit" className={styles.primaryBtn} disabled={resultInquirySaving}>{resultInquirySaving ? "접수 중..." : "상담 신청하기"}</button>
          </form>
        </section>

        <div className={styles.bottomDock}>
          <a href={formatPhoneHref(displayPhone)} className={styles.bottomActionPrimary}>전화 상담</a>
          <a href={displayKakaoUrl} target="_blank" rel="noreferrer" className={styles.bottomActionKakao}>카카오 상담</a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <div className={styles.logoBadge}>
            <img src={displayLogoUrl} alt={companyName} className={styles.logo} />
          </div>
          <div className={styles.brandText}>
            <strong>{companyName}</strong>
            <span>{companySub}</span>
          </div>
        </div>
        <a href={formatPhoneHref(displayPhone)} className={styles.headerCallMini}>전화상담</a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroBadgeRow}>
          <span className={styles.heroBadge}>주택담보대출 상담</span>
          <span className={styles.heroNote}>모바일 간편 접수</span>
        </div>
        <h1 className={styles.heroTitle}>내 상황에 맞는 대출 상담,{"\n"}모바일에서 간편하게 확인하세요</h1>
        <p className={styles.heroDesc}>
          아파트 시세조회부터 상담 신청까지 한 번에 진행할 수 있도록
          보기 편하고 이해하기 쉽게 구성했습니다.
        </p>
        <div className={styles.heroActions}>
          <a href="#quick-search" className={styles.primaryBtn}>빠른 시세조회</a>
          <a href="#consult" className={styles.secondaryBtn}>상담 신청하기</a>
        </div>
      </section>

      <section className={styles.quickContactWrap}>
        <a href={formatPhoneHref(displayPhone)} className={styles.quickContactCard}>
          <em>대표번호</em>
          <strong>{displayPhone}</strong>
          <span>전화로 바로 상담받기</span>
        </a>
        <a href={displayKakaoUrl} target="_blank" rel="noreferrer" className={styles.quickKakaoCard}>
          <em>카카오톡 상담</em>
          <strong>{displayKakaoId}</strong>
          <span>카카오톡으로 편하게 문의하기</span>
        </a>
      </section>

      <section id="quick-search" className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span>시세조회</span>
          <h2>아파트 시세를 먼저 확인해보세요</h2>
          <p>주소와 단지, 면적을 선택하시면 조회가 가능합니다.</p>
        </div>
        <div className={styles.formStack}>
          <label className={styles.fieldLabel}>
            <span>시 / 도</span>
            <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
              <option value="">선택해주세요</option>
              {cities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            <span>시 / 군 / 구</span>
            <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} disabled={!selectedCity}>
              <option value="">선택해주세요</option>
              {districts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            <span>읍 / 면 / 동</span>
            <select value={selectedTown} onChange={(e) => setSelectedTown(e.target.value)} disabled={!selectedDistrict}>
              <option value="">선택해주세요</option>
              {towns.map((town) => <option key={town} value={town}>{town}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            <span>아파트명</span>
            <select value={selectedApartment} onChange={(e) => setSelectedApartment(e.target.value)} disabled={!selectedTown}>
              <option value="">선택해주세요</option>
              {apartments.map((apartment) => <option key={apartment} value={apartment}>{apartment}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            <span>면적</span>
            <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} disabled={!selectedApartment}>
              <option value="">선택해주세요</option>
              {areas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
          </label>

          {catalogNote ? <div className={styles.helperText}>{catalogNote}</div> : null}
          {catalogLoading ? <div className={styles.helperText}>단지 정보를 불러오는 중입니다.</div> : null}
          {marketError ? <div className={`${styles.status} ${styles.statusError}`}>{marketError}</div> : null}

          <button type="button" className={styles.primaryBtn} onClick={handleMarketSearch} disabled={marketLoading}>
            {marketLoading ? "조회 중..." : "시세 조회하기"}
          </button>
        </div>
      </section>

      {approvalCases.length > 0 ? (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <span>승인사례</span>
            <h2>최근 상담 사례를 확인해보세요</h2>
          </div>
          <div className={styles.reviewList}>
            {approvalCases.slice(0, 4).map((review, index) => (
              <article key={review.id || index} className={styles.reviewCard}>
                <div className={styles.reviewTop}>
                  <strong>{review.title || review.name || "상담 진행 사례"}</strong>
                  {review.created_at ? <span>{String(review.created_at).slice(0, 10).replaceAll("-", ".")}</span> : null}
                </div>
                <p>{review.summary || review.description || review.content || "고객 상황에 맞춰 상담을 진행한 사례입니다."}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="consult" className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span>간편 상담 신청</span>
          <h2>이름과 연락처만 남겨주세요</h2>
          <p>확인 후 빠르게 연락드리겠습니다.</p>
        </div>
        <form className={styles.formStack} onSubmit={submitHomeInquiry}>
          <label className={styles.fieldLabel}>
            <span>성함</span>
            <input type="text" placeholder="성함을 입력해주세요" value={homeInquiry.name} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, name: e.target.value }))} />
          </label>
          <label className={styles.fieldLabel}>
            <span>연락처</span>
            <input type="text" placeholder="연락처를 입력해주세요" value={homeInquiry.phone} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, phone: e.target.value }))} />
          </label>
          <label className={styles.fieldLabel}>
            <span>상담 유형</span>
            <select value={homeInquiry.loanType} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, loanType: e.target.value }))}>
              {loanTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            <span>주소</span>
            <input type="text" placeholder="주소를 입력해주세요" value={homeInquiry.address} onChange={(e) => setHomeInquiry((prev) => ({ ...prev, address: e.target.value }))} />
          </label>
          {homeInquiryStatus ? <div className={`${styles.status} ${statusClass(homeInquiryStatus, styles)}`}>{homeInquiryStatus}</div> : null}
          <button type="submit" className={styles.primaryBtn} disabled={homeInquirySaving}>{homeInquirySaving ? "접수 중..." : "상담 신청하기"}</button>
        </form>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span>자주 묻는 질문</span>
          <h2>상담 전에 많이 궁금해하시는 내용입니다</h2>
        </div>
        <div className={styles.faqList}>
          {faqItems.map((item) => (
            <article key={item.q} className={styles.faqItem}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.legalSection}>
        <div className={styles.legalLines}>
          <div>이자율 : 연6% ~ 연20%이내 (연체이자율 연 7% ~ 20% 이내, 취급수수료 및 기타 부대비용없음)</div>
          <div>중개수수료를 요구하거나 받는 것은 불법입니다.</div>
          <div>과도한 빚, 고통의 시작입니다. 대출 시 귀하의 신용등급이 하락할 수 있습니다.</div>
          <div>이 사이트에서 광고되는 상품들의 상환 기간은 모두 60일 이상이며 (최저 2개월, 최대 5년), 최대 연 이자율은 20%입니다.</div>
          <div>대부이자율(연 이자율) 및 연체이자율은 연 20%를 초과할 수 없습니다. (조기상환 조건없음)</div>
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

        <div className={styles.legalCopy}>© 엔드아이에셋대부. All Rights Reserved.</div>
      </section>

      <div className={styles.bottomDock}>
        <a href={formatPhoneHref(displayPhone)} className={styles.bottomActionPrimary}>전화 상담</a>
        <a href={displayKakaoUrl} target="_blank" rel="noreferrer" className={styles.bottomActionKakao}>카카오 상담</a>
      </div>
    </div>
  );
}
