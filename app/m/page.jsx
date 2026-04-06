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
    q: "주택담보대출 한도와 금리는 무엇으로 달라지나요?",
    a: "담보물 평가, 소득과 신용, 기존 부채, 상품 조건 등에 따라 달라질 수 있습니다. 정확한 조건은 상담 후 안내받는 것이 가장 빠릅니다.",
  },
  {
    q: "대환대출도 상담 가능한가요?",
    a: "네. 기존 대출 조건과 현재 상황을 함께 확인해 보고 가능한 방향을 안내해드립니다.",
  },
  {
    q: "상담 신청하면 바로 연락이 오나요?",
    a: "접수해 주시면 확인 후 순차적으로 연락드립니다. 빠른 상담이 필요하시면 대표번호 또는 카카오톡으로 문의하실 수 있습니다.",
  },
  {
    q: "시세조회만 먼저 해봐도 되나요?",
    a: "네. 시세조회 후 상담 신청까지 이어서 진행하실 수 있습니다.",
  },
];

function maskName(name) {
  const value = String(name || "고객").trim();
  if (!value) return "고객님";
  if (value.length === 1) return `${value}*`;
  if (value.length === 2) return `${value[0]}*`;
  return `${value[0]}*${value[value.length - 1]}`;
}

export default function MobileLandingPage() {
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [activeFaq, setActiveFaq] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(true);

  const [inquiry, setInquiry] = useState({
    name: "",
    phone: "",
    address: "",
    loanType: loanTypeOptions[0],
    memo: "",
  });
  const [inquirySaving, setInquirySaving] = useState(false);
  const [inquiryStatus, setInquiryStatus] = useState("");

  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedTown, setSelectedTown] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [catalogOptions, setCatalogOptions] = useState({ cities: [], districts: [], towns: [], apartments: [], areas: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [lookupStarted, setLookupStarted] = useState(false);

  useEffect(() => {
    setSiteSettings(readCachedSiteSettings());

    fetch("/api/site-settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) {
          setSiteSettings(data.settings);
          cacheSiteSettings(data.settings);
        }
      })
      .catch(() => {});

    fetch("/api/reviews?limit=6", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setReviews(Array.isArray(data?.reviews) ? data.reviews : []))
      .catch(() => setReviews([]))
      .finally(() => setReviewLoading(false));
  }, []);

  useEffect(() => {
    loadCatalogOptions();
  }, []);

  async function loadCatalogOptions(overrides = {}) {
    const city = overrides.city ?? selectedCity;
    const district = overrides.district ?? selectedDistrict;
    const town = overrides.town ?? selectedTown;
    const apartment = overrides.apartment ?? selectedApartment;
    const area = overrides.area ?? selectedArea;

    setCatalogLoading(true);
    setCatalogMessage("");
    try {
      const params = new URLSearchParams({ propertyType: "아파트" });
      if (city) params.set("city", city);
      if (district) params.set("district", district);
      if (town) params.set("town", town);
      if (apartment) params.set("apartment", apartment);
      if (area) params.set("area", area);

      const res = await fetch(`/api/property-catalog?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "시세조회 정보를 불러오지 못했습니다.");
      setCatalogOptions(data.options || { cities: [], districts: [], towns: [], apartments: [], areas: [] });
      setCatalogMessage(data.warning || "");
    } catch (error) {
      setCatalogOptions({ cities: [], districts: [], towns: [], apartments: [], areas: [] });
      setCatalogMessage(error.message || "시세조회 정보를 불러오지 못했습니다.");
    } finally {
      setCatalogLoading(false);
    }
  }

  const selectedSummary = useMemo(() => {
    return [selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedArea].filter(Boolean).join(" · ");
  }, [selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedArea]);

  async function handleInquirySubmit(e) {
    e.preventDefault();
    setInquirySaving(true);
    setInquiryStatus("");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inquiry,
          sourcePage: "mobile",
          propertyType: "아파트",
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          area: selectedArea,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "상담 신청에 실패했습니다.");
      setInquiryStatus("상담 신청이 접수되었습니다. 확인 후 연락드리겠습니다.");
      setInquiry({ name: "", phone: "", address: "", loanType: loanTypeOptions[0], memo: "" });
    } catch (error) {
      setInquiryStatus(error.message || "상담 신청에 실패했습니다.");
    } finally {
      setInquirySaving(false);
    }
  }

  function handleLookup() {
    setLookupStarted(true);
    if (!selectedCity || !selectedDistrict || !selectedTown || !selectedApartment || !selectedArea) {
      setCatalogMessage("시/도부터 면적까지 모두 선택해 주세요.");
      return;
    }
    const params = new URLSearchParams({
      city: selectedCity,
      district: selectedDistrict,
      town: selectedTown,
      apartment: selectedApartment,
      area: selectedArea,
    });
    window.location.href = `/price-result?${params.toString()}`;
  }

  const displayLogoUrl = siteSettings.logo_url || "/andi-logo.jpg";
  const displayPhone = siteSettings.phone || "070-8018-7437";
  const displayKakaoUrl = siteSettings.kakao_url || "https://open.kakao.com/o/sbaltXmi";
  const displayKakaoId = siteSettings.kakao_id || "ANDi7437";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <img src={displayLogoUrl} alt={siteSettings.company_name || "엔드아이에셋대부"} className={styles.logo} />
          <div>
            <div className={styles.brandName}>{siteSettings.company_name || "엔드아이에셋대부"}</div>
            <div className={styles.brandSub}>{siteSettings.company_subtitle || "주택담보대출 · 대환대출 · 전세퇴거자금 상담"}</div>
          </div>
        </div>
        <a href={`tel:${displayPhone}`} className={styles.headerCall}>전화상담</a>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.badge}>{siteSettings.hero_badge || "주택담보대출 상담"}</div>
          <h1 className={styles.heroTitle}>{siteSettings.hero_title || "필요한 상담을 빠르게 연결해드립니다."}</h1>
          <p className={styles.heroDesc}>{siteSettings.hero_description || "복잡하게 찾지 마시고, 상담 신청부터 편하게 남겨주세요."}</p>

          <div className={styles.quickGrid}>
            <a href="#consult" className={`${styles.quickCard} ${styles.primaryCard}`}>
              <strong>상담 신청</strong>
              <span>이름과 연락처만 남기면 접수 완료</span>
            </a>
            <a href="#lookup" className={styles.quickCard}>
              <strong>시세조회</strong>
              <span>지역과 단지 선택 후 바로 확인</span>
            </a>
          </div>

          <div className={styles.contactRow}>
            <a href={`tel:${displayPhone}`} className={`${styles.contactButton} ${styles.callButton}`}>
              <strong>대표번호</strong>
              <span>{displayPhone}</span>
            </a>
            <a href={displayKakaoUrl} target="_blank" rel="noreferrer" className={`${styles.contactButton} ${styles.kakaoButton}`}>
              <strong>카카오톡 상담</strong>
              <span>ID : {displayKakaoId}</span>
            </a>
          </div>
        </section>

        <section id="consult" className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionMini}>빠른 접수</div>
            <h2 className={styles.sectionTitle}>상담 신청</h2>
            <p className={styles.sectionDesc}>성함과 연락처를 남겨주시면 확인 후 연락드립니다.</p>
          </div>

          <form className={styles.formCard} onSubmit={handleInquirySubmit}>
            <label className={styles.field}>
              <span>성함</span>
              <input type="text" placeholder="성함을 입력해 주세요" value={inquiry.name} onChange={(e) => setInquiry((prev) => ({ ...prev, name: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>연락처</span>
              <input type="text" placeholder="연락처를 입력해 주세요" value={inquiry.phone} onChange={(e) => setInquiry((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>주소</span>
              <input type="text" placeholder="예: 서울시 서초구" value={inquiry.address} onChange={(e) => setInquiry((prev) => ({ ...prev, address: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>대출 유형</span>
              <select value={inquiry.loanType} onChange={(e) => setInquiry((prev) => ({ ...prev, loanType: e.target.value }))}>
                {loanTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>추가 문의</span>
              <textarea rows={4} placeholder="남기실 내용이 있으면 입력해 주세요" value={inquiry.memo} onChange={(e) => setInquiry((prev) => ({ ...prev, memo: e.target.value }))} />
            </label>
            {inquiryStatus ? <div className={`${styles.status} ${inquiryStatus.includes("접수") ? styles.success : styles.error}`}>{inquiryStatus}</div> : null}
            <button type="submit" className={styles.submitButton} disabled={inquirySaving}>{inquirySaving ? "접수 중..." : "상담 신청하기"}</button>
          </form>
        </section>

        <section id="lookup" className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionMini}>간편 조회</div>
            <h2 className={styles.sectionTitle}>시세조회</h2>
            <p className={styles.sectionDesc}>거주 지역과 단지를 선택하면 바로 조회 화면으로 이동합니다.</p>
          </div>

          <div className={styles.formCard}>
            <label className={styles.field}>
              <span>시/도</span>
              <select value={selectedCity} onChange={(e) => {
                const value = e.target.value;
                setSelectedCity(value); setSelectedDistrict(""); setSelectedTown(""); setSelectedApartment(""); setSelectedArea("");
                loadCatalogOptions({ city: value, district: "", town: "", apartment: "", area: "" });
              }}>
                <option value="">선택해 주세요</option>
                {catalogOptions.cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>시/군/구</span>
              <select value={selectedDistrict} onChange={(e) => {
                const value = e.target.value;
                setSelectedDistrict(value); setSelectedTown(""); setSelectedApartment(""); setSelectedArea("");
                loadCatalogOptions({ city: selectedCity, district: value, town: "", apartment: "", area: "" });
              }}>
                <option value="">선택해 주세요</option>
                {catalogOptions.districts.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>읍/면/동</span>
              <select value={selectedTown} onChange={(e) => {
                const value = e.target.value;
                setSelectedTown(value); setSelectedApartment(""); setSelectedArea("");
                loadCatalogOptions({ city: selectedCity, district: selectedDistrict, town: value, apartment: "", area: "" });
              }}>
                <option value="">선택해 주세요</option>
                {catalogOptions.towns.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>아파트</span>
              <select value={selectedApartment} onChange={(e) => {
                const value = e.target.value;
                setSelectedApartment(value); setSelectedArea("");
                loadCatalogOptions({ city: selectedCity, district: selectedDistrict, town: selectedTown, apartment: value, area: "" });
              }}>
                <option value="">선택해 주세요</option>
                {catalogOptions.apartments.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span>면적</span>
              <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                <option value="">선택해 주세요</option>
                {catalogOptions.areas.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            {selectedSummary ? <div className={styles.summaryBox}>{selectedSummary}</div> : null}
            {catalogMessage ? <div className={`${styles.status} ${catalogMessage.includes("모두 선택") ? styles.error : styles.info}`}>{catalogMessage}</div> : null}
            <button type="button" className={styles.submitButton} onClick={handleLookup} disabled={catalogLoading}>
              {catalogLoading ? "불러오는 중..." : "시세조회 하기"}
            </button>
            {!lookupStarted ? <p className={styles.helper}>상담 신청 없이 먼저 조회만 해보셔도 됩니다.</p> : null}
          </div>
        </section>

        {siteSettings.reviews_enabled !== false && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionMini}>확인해 보세요</div>
              <h2 className={styles.sectionTitle}>승인사례</h2>
            </div>
            <div className={styles.reviewList}>
              {reviewLoading ? <div className={styles.emptyBox}>승인사례를 불러오는 중입니다.</div> : null}
              {!reviewLoading && reviews.length === 0 ? <div className={styles.emptyBox}>등록된 승인사례가 없습니다.</div> : null}
              {!reviewLoading && reviews.map((item) => (
                <article key={item.id} className={styles.reviewCard}>
                  <div className={styles.reviewTop}>
                    <strong>{item.title || "승인사례"}</strong>
                    <span>{maskName(item.name)}</span>
                  </div>
                  <p>{String(item.content || "").slice(0, 90)}{String(item.content || "").length > 90 ? "..." : ""}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionMini}>자주 묻는 질문</div>
            <h2 className={styles.sectionTitle}>FAQ</h2>
          </div>
          <div className={styles.faqList}>
            {faqItems.map((item, index) => (
              <div key={item.q} className={styles.faqItem}>
                <button type="button" className={styles.faqQuestion} onClick={() => setActiveFaq(activeFaq === index ? -1 : index)}>
                  <span>{item.q}</span>
                  <span>{activeFaq === index ? "−" : "+"}</span>
                </button>
                {activeFaq === index ? <div className={styles.faqAnswer}>{item.a}</div> : null}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.legalLines}>
          <div>이자율 : 연6% ~ 연20%이내 (연체이자율 연 7% ~ 20% 이내, 취급수수료 및 기타 부대비용없음)</div>
          <div>중개수수료를 요구하거나 받는 것은 불법입니다.</div>
          <div>과도한 빚, 고통의 시작입니다. 대출 시 귀하의 신용등급이 하락할 수 있습니다.</div>
        </div>
        <div className={styles.metaGrid}>
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
        <a href={`tel:${displayPhone}`} className={styles.bottomCall}>전화상담</a>
        <a href={displayKakaoUrl} target="_blank" rel="noreferrer" className={styles.bottomKakao}>카카오톡 상담</a>
      </div>
    </div>
  );
}
