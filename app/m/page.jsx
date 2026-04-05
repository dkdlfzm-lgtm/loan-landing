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

function normalizePhoneLink(phone = "") {
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}

export default function MobileLandingPage() {
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [approvalCases, setApprovalCases] = useState([]);
  const [propertyType, setPropertyType] = useState("아파트");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedTown, setSelectedTown] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [apartmentQuery, setApartmentQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [catalogOptions, setCatalogOptions] = useState({ cities: [], districts: [], towns: [], apartments: [], areas: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogNote, setCatalogNote] = useState("");
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketResult, setMarketResult] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", loanType: loanTypeOptions[0], memo: "" });
  const [formSaving, setFormSaving] = useState(false);
  const [formStatus, setFormStatus] = useState("");

  const displayPhone = siteSettings.phone || DEFAULT_SITE_SETTINGS.phone;
  const displayKakaoUrl = siteSettings.kakao_url || DEFAULT_SITE_SETTINGS.kakao_url;
  const displayLogoUrl = siteSettings.logo_url || DEFAULT_SITE_SETTINGS.logo_url;
  const displayCompanyName = siteSettings.company_name || DEFAULT_SITE_SETTINGS.company_name;
  const displaySubtitle = siteSettings.company_subtitle || DEFAULT_SITE_SETTINGS.company_subtitle;

  const filteredApartments = useMemo(() => {
    const keyword = apartmentQuery.trim().toLowerCase();
    if (!keyword) return catalogOptions.apartments.slice(0, 80);
    return catalogOptions.apartments.filter((item) => item.toLowerCase().includes(keyword)).slice(0, 80);
  }, [catalogOptions.apartments, apartmentQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadSiteSettings() {
      try {
        const cached = readCachedSiteSettings();
        if (!cancelled && cached) setSiteSettings(cached);

        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false || !data?.settings) {
          throw new Error("사이트 설정을 불러오지 못했습니다.");
        }
        if (!cancelled) {
          const normalized = { ...DEFAULT_SITE_SETTINGS, ...data.settings };
          setSiteSettings(normalized);
          cacheSiteSettings(normalized);
        }
      } catch {
        if (!cancelled) {
          setSiteSettings(readCachedSiteSettings() || DEFAULT_SITE_SETTINGS);
        }
      }
    }

    loadSiteSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadApprovalCases() {
      try {
        const response = await fetch("/api/reviews?limit=4", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error();
        if (!cancelled) setApprovalCases(Array.isArray(data.reviews) ? data.reviews : []);
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
          propertyType,
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          area: selectedArea,
        });
        const response = await fetch(`/api/property-catalog?${query.toString()}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.message || "목록을 불러오지 못했습니다.");
        }
        if (cancelled) return;
        setCatalogOptions(data.options || { cities: [], districts: [], towns: [], apartments: [], areas: [] });
        setCatalogNote(data.warning || data.note || "");
        setSelectedCity(data.query?.city || "");
        setSelectedDistrict(data.query?.district || "");
        setSelectedTown(data.query?.town || "");
        setSelectedApartment(data.query?.apartment || "");
        setSelectedArea(data.query?.area || "");
        setApartmentQuery(data.query?.apartment || "");
      } catch (error) {
        if (!cancelled) setCatalogError(error?.message || "목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [propertyType, selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedArea]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      address: [selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedArea].filter(Boolean).join(" "),
    }));
  }, [selectedCity, selectedDistrict, selectedTown, selectedApartment, selectedArea]);

  const handleLookup = async () => {
    if (!selectedCity || !selectedDistrict || !selectedTown || !selectedApartment || !selectedArea) {
      setMarketError("시/도, 시/군/구, 읍/면/동, 단지명, 면적을 모두 선택해주세요.");
      return;
    }

    setMarketLoading(true);
    setMarketError("");

    try {
      const query = new URLSearchParams({
        propertyType,
        city: selectedCity,
        district: selectedDistrict,
        town: selectedTown,
        apartment: selectedApartment,
        area: selectedArea,
      });
      const response = await fetch(`/api/reb-market?${query.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || "시세 정보를 불러오지 못했습니다.");
      }
      setMarketResult(data);
      document.getElementById("result-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setMarketResult(null);
      setMarketError(error?.message || "시세 정보를 불러오지 못했습니다.");
    } finally {
      setMarketLoading(false);
    }
  };

  const submitInquiry = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setFormStatus("성함과 연락처를 입력해주세요.");
      return;
    }

    setFormSaving(true);
    setFormStatus("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sourcePage: "mobile-home",
          propertyType,
          city: selectedCity,
          district: selectedDistrict,
          town: selectedTown,
          apartment: selectedApartment,
          area: selectedArea,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || "상담 접수를 저장하지 못했습니다.");
      }
      setFormStatus("상담 접수가 완료되었습니다. 확인 후 빠르게 연락드리겠습니다.");
      setForm({ name: "", phone: "", address: "", loanType: loanTypeOptions[0], memo: "" });
    } catch (error) {
      setFormStatus(error?.message || "상담 접수를 저장하지 못했습니다.");
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logoBox}>
            <img src={displayLogoUrl} alt={displayCompanyName} className={styles.logo} />
          </div>
          <div className={styles.brandText}>
            <strong>{displayCompanyName}</strong>
            <span>{displaySubtitle}</span>
          </div>
        </div>
        <a href={normalizePhoneLink(displayPhone)} className={styles.callBtn}>전화상담</a>
      </header>

      <section className={styles.hero}>
        <p className={styles.heroBadge}>모바일 전용 간편 상담</p>
        <h1 className={styles.heroTitle}>복잡한 화면 대신<br />읽기 쉬운 대출 상담 화면으로<br />다시 구성했습니다</h1>
        <p className={styles.heroDesc}>
          시세조회부터 상담 접수까지 한 화면에서 천천히 따라오시면 됩니다.
          글씨는 더 크게, 버튼은 더 넓게, 순서는 더 단순하게 정리했습니다.
        </p>
        <div className={styles.heroActions}>
          <a href="#lookup" className={styles.primaryBtn}>시세조회 시작하기</a>
          <a href="#consult" className={styles.secondaryBtn}>무료 상담 신청</a>
        </div>
        <div className={styles.contactGrid}>
          <a href={normalizePhoneLink(displayPhone)} className={styles.contactCard}>
            <em>대표번호</em>
            <strong>{displayPhone}</strong>
            <span>터치하면 바로 전화 연결</span>
          </a>
          <a href={displayKakaoUrl} target="_blank" rel="noreferrer" className={`${styles.contactCard} ${styles.kakaoCard}`}>
            <em>카카오 상담</em>
            <strong>카카오톡 문의</strong>
            <span>채팅으로 편하게 상담</span>
          </a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>이용 방법</h2>
          <p>아래 순서대로 선택하면 됩니다.</p>
        </div>
        <div className={styles.stepList}>
          <article className={styles.stepCard}><b>1</b><div><strong>지역과 단지를 선택</strong><p>시/도부터 단지명, 면적까지 순서대로 선택해 주세요.</p></div></article>
          <article className={styles.stepCard}><b>2</b><div><strong>시세를 먼저 확인</strong><p>조회 버튼을 누르면 예상 시세와 안내 문구를 바로 확인할 수 있습니다.</p></div></article>
          <article className={styles.stepCard}><b>3</b><div><strong>상담을 신청</strong><p>성함과 연락처를 남겨주시면 확인 후 빠르게 안내드립니다.</p></div></article>
        </div>
      </section>

      <section className={styles.section} id="lookup">
        <div className={styles.sectionHeader}>
          <h2>아파트 시세조회</h2>
          <p>아래 항목을 차례대로 선택해 주세요.</p>
        </div>

        <div className={styles.formCard}>
          <label className={styles.field}>
            <span>담보 종류</span>
            <select value={propertyType} onChange={(e) => {
              setPropertyType(e.target.value);
              setSelectedCity("");
              setSelectedDistrict("");
              setSelectedTown("");
              setSelectedApartment("");
              setApartmentQuery("");
              setSelectedArea("");
              setMarketResult(null);
            }}>
              <option value="아파트">아파트</option>
              <option value="오피스텔">오피스텔</option>
              <option value="빌라(연립/다세대)">빌라(연립/다세대)</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>시 / 도</span>
            <select value={selectedCity} onChange={(e) => {
              setSelectedCity(e.target.value);
              setSelectedDistrict("");
              setSelectedTown("");
              setSelectedApartment("");
              setApartmentQuery("");
              setSelectedArea("");
              setMarketResult(null);
            }}>
              <option value="">선택하세요</option>
              {catalogOptions.cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span>시 / 군 / 구</span>
            <select value={selectedDistrict} onChange={(e) => {
              setSelectedDistrict(e.target.value);
              setSelectedTown("");
              setSelectedApartment("");
              setApartmentQuery("");
              setSelectedArea("");
              setMarketResult(null);
            }} disabled={!selectedCity}>
              <option value="">선택하세요</option>
              {catalogOptions.districts.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span>읍 / 면 / 동</span>
            <select value={selectedTown} onChange={(e) => {
              setSelectedTown(e.target.value);
              setSelectedApartment("");
              setApartmentQuery("");
              setSelectedArea("");
              setMarketResult(null);
            }} disabled={!selectedDistrict}>
              <option value="">선택하세요</option>
              {catalogOptions.towns.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span>단지명 검색</span>
            <input
              type="text"
              value={apartmentQuery}
              onChange={(e) => {
                setApartmentQuery(e.target.value);
                setSelectedApartment("");
                setSelectedArea("");
                setMarketResult(null);
              }}
              placeholder="아파트명을 입력해 주세요"
              disabled={!selectedTown}
            />
          </label>

          {!!selectedTown && (
            <div className={styles.apartmentPanel}>
              <p className={styles.panelTitle}>단지명 선택</p>
              <div className={styles.apartmentList}>
                {filteredApartments.length ? filteredApartments.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={item === selectedApartment ? styles.apartmentItemActive : styles.apartmentItem}
                    onClick={() => {
                      setSelectedApartment(item);
                      setApartmentQuery(item);
                      setSelectedArea("");
                      setMarketResult(null);
                    }}
                  >
                    {item}
                  </button>
                )) : <div className={styles.emptyText}>검색 결과가 없습니다.</div>}
              </div>
            </div>
          )}

          <label className={styles.field}>
            <span>면적</span>
            <select value={selectedArea} onChange={(e) => { setSelectedArea(e.target.value); setMarketResult(null); }} disabled={!selectedApartment}>
              <option value="">선택하세요</option>
              {catalogOptions.areas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          {(catalogLoading || catalogError || catalogNote) && (
            <div className={styles.noticeBox}>
              {catalogLoading ? <p>단지 목록을 불러오는 중입니다.</p> : null}
              {catalogError ? <p>{catalogError}</p> : null}
              {catalogNote ? <p>{catalogNote}</p> : null}
            </div>
          )}

          <button type="button" className={styles.lookupBtn} onClick={handleLookup} disabled={marketLoading}>
            {marketLoading ? "조회 중입니다..." : "시세조회 결과 보기"}
          </button>
          {marketError ? <p className={styles.errorText}>{marketError}</p> : null}
        </div>
      </section>

      <section className={styles.section} id="result-card">
        <div className={styles.sectionHeader}>
          <h2>조회 결과</h2>
          <p>조회 후 아래 카드에서 결과를 확인할 수 있습니다.</p>
        </div>
        {marketResult?.summary ? (
          <article className={styles.resultCard}>
            <div className={styles.resultTop}>
              <span className={styles.resultBadge}>{marketResult.source === "reb-openapi" ? "실제 통계 기반" : "예시 결과"}</span>
              <strong>{marketResult.summary.title}</strong>
              <p>{marketResult.summary.address} · {marketResult.summary.area}</p>
            </div>
            <div className={styles.resultStats}>
              <div><span>최근 시세</span><strong>{marketResult.summary.latestPrice}</strong></div>
              <div><span>예상 범위</span><strong>{marketResult.summary.range}</strong></div>
              <div><span>예상 한도</span><strong>{marketResult.summary.estimateLimit}</strong></div>
              <div><span>기준 시점</span><strong>{marketResult.summary.tradeDate}</strong></div>
            </div>
            <p className={styles.resultDesc}>{marketResult.summary.description}</p>
            {marketResult.summary.trendText ? <p className={styles.resultTrend}>{marketResult.summary.trendText}</p> : null}
          </article>
        ) : (
          <div className={styles.emptyResult}>아직 조회 결과가 없습니다. 위에서 항목을 선택한 뒤 조회 버튼을 눌러주세요.</div>
        )}
      </section>

      <section className={styles.section} id="consult">
        <div className={styles.sectionHeader}>
          <h2>무료 상담 신청</h2>
          <p>성함과 연락처만 남겨도 빠르게 확인해드립니다.</p>
        </div>
        <form className={styles.formCard} onSubmit={submitInquiry}>
          <label className={styles.field}>
            <span>성함</span>
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="성함을 입력해 주세요" />
          </label>
          <label className={styles.field}>
            <span>연락처</span>
            <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="연락처를 입력해 주세요" inputMode="tel" />
          </label>
          <label className={styles.field}>
            <span>대출 종류</span>
            <select value={form.loanType} onChange={(e) => setForm((prev) => ({ ...prev, loanType: e.target.value }))}>
              {loanTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>주소 / 조회 단지</span>
            <input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} placeholder="예: 서울 강남구 역삼동" />
          </label>
          <label className={styles.field}>
            <span>남기실 말씀</span>
            <textarea value={form.memo} onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))} placeholder="상담 원하는 내용을 적어주세요" rows={4} />
          </label>
          <button type="submit" className={styles.submitBtn} disabled={formSaving}>{formSaving ? "접수 중입니다..." : "무료 상담 신청하기"}</button>
          {formStatus ? <p className={formStatus.includes("완료") ? styles.successText : styles.errorText}>{formStatus}</p> : null}
        </form>
      </section>

      {!!approvalCases.length && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>최근 승인사례</h2>
            <p>최근 등록된 사례를 간단히 확인할 수 있습니다.</p>
          </div>
          <div className={styles.caseList}>
            {approvalCases.map((item) => (
              <article key={item.id} className={styles.caseCard}>
                <strong>{item.title || item.customer_name || "승인사례"}</strong>
                <p>{item.summary || item.description || item.content || "상담 후 승인 진행 사례입니다."}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className={styles.bottomBar}>
        <a href={normalizePhoneLink(displayPhone)} className={styles.bottomCall}>전화상담</a>
        <a href={displayKakaoUrl} target="_blank" rel="noreferrer" className={styles.bottomKakao}>카카오상담</a>
      </div>
    </main>
  );
}
