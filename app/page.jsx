"use client";

import { useEffect, useState } from "react";

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

export default function HomePage() {
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

  const goToResult = () => {
    const params = new URLSearchParams({
      city: selectedCity,
      district: selectedDistrict,
      town: selectedTown,
      apartment: selectedApartment,
      area: selectedArea,
    });

    window.location.href = `/price-result?${params.toString()}`;
  };

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
            <a href="#contact" className="nav-btn">상담 신청</a>
          </nav>
        </div>
      </header>

      <main>
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
                지역, 단지명, 면적을 차례대로 선택하고 조회를 누르면 결과 전용 페이지로
                이동하는 구조입니다.
              </p>

              <div className="hero-actions">
                <a href="#quick-search" className="btn btn-white">빠른 시세조회</a>
                <a href="#contact" className="btn btn-outline">무료 상담 신청</a>
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
                <button type="button" className="primary-btn">상담 신청하기</button>
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
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>

                  <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)}>
                    {districts.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>

                  <select value={selectedTown} onChange={(e) => setSelectedTown(e.target.value)}>
                    {towns.map((town) => (
                      <option key={town} value={town}>{town}</option>
                    ))}
                  </select>
                </div>

                <div className="select-grid select-grid-main">
                  <select value={selectedApartment} onChange={(e) => setSelectedApartment(e.target.value)}>
                    {apartments.map((apartment) => (
                      <option key={apartment} value={apartment}>{apartment}</option>
                    ))}
                  </select>

                  <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                    {areas.map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>

                  <button type="button" className="search-btn" onClick={goToResult}>
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

        <section id="contact" className="section faq-section">
          <div className="container faq-wrap">
            <div className="section-center">
              <div className="section-mini">안내</div>
              <h2 className="section-title">시세조회 후 상담 신청 가능</h2>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <div className="footer-title">회사명 또는 브랜드명</div>
            <p>이 영역은 실제 운영 시 사업자 정보, 업체 설명, 안내 문구를 정리해서 넣는 공간입니다.</p>
          </div>
          <div className="footer-info">
            <div>대표번호: 010-0000-0000</div>
            <div>운영시간: 평일 09:00 - 18:00</div>
            <div>주소: 서울시 예시 주소 입력</div>
            <div>사업자등록번호: 000-00-00000</div>
            <div>개인정보처리방침 | 이용약관</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
