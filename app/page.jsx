export default function LoanLandingPage() {
  const faq = [
    {
      q: "상담 신청 후 얼마나 빨리 연락이 오나요?",
      a: "접수 내용을 확인한 뒤 순차적으로 빠르게 연락드립니다.",
    },
    {
      q: "상담 신청은 무료인가요?",
      a: "네, 홈페이지를 통한 상담 신청은 무료로 진행됩니다.",
    },
    {
      q: "어떤 정보까지 입력해야 하나요?",
      a: "성함과 연락처를 기본으로 받고, 필요한 경우 간단한 상담 내용을 추가로 남기실 수 있습니다.",
    },
    {
      q: "상담 내용은 안전하게 관리되나요?",
      a: "입력된 상담 정보는 관리자 확인용으로만 사용되는 구조를 기준으로 설계할 수 있습니다.",
    },
  ];

  const products = [
    {
      title: "아파트 담보대출",
      desc: "아파트를 기준으로 고객 상황에 맞는 상담을 빠르게 도와드립니다.",
      badge: "대표 상품",
    },
    {
      title: "주택 · 빌라 담보대출",
      desc: "주택 및 빌라 조건에 맞춘 상담 흐름으로 안내할 수 있습니다.",
      badge: "상담 가능",
    },
    {
      title: "오피스텔 담보대출",
      desc: "오피스텔 기준 상담이 가능하도록 별도 카테고리로 구성할 수 있습니다.",
      badge: "맞춤 안내",
    },
  ];

  const steps = [
    "상담 신청",
    "담당자 확인",
    "개별 연락",
    "상담 진행",
  ];

  return (
    <div className="page">
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
            <a href="#products">상품안내</a>
            <a href="#process">진행절차</a>
            <a href="#faq">FAQ</a>
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
              <div className="hero-pill">간편 접수 · 빠른 상담 연결</div>

              <h1 className="hero-title">
                복잡한 대출 상담,
                <br />
                더 쉽고 빠르게
                <br />
                접수받는 홈페이지
              </h1>

              <p className="hero-text">
                이름과 연락처만 남겨도 바로 상담 흐름으로 이어질 수 있게 구성한
                대출 상담 랜딩페이지 예시입니다. 참고 사이트처럼 첫 화면에서
                바로 신청이 가능하도록 배치했습니다.
              </p>

              <div className="hero-actions">
                <a href="#contact" className="btn btn-white">무료 상담 신청</a>
                <a href="#products" className="btn btn-outline">상품 안내 보기</a>
              </div>

              <div className="hero-stats">
                <div className="stat-box">
                  <div className="stat-label">상담 접수</div>
                  <div className="stat-value">24시간</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">운영 시간</div>
                  <div className="stat-value">09:00 - 18:00</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">빠른 문의</div>
                  <div className="stat-value">010-0000-0000</div>
                </div>
              </div>
            </div>

            <div id="contact" className="hero-right">
              <div className="form-card">
                <div className="form-head">
                  <div>
                    <div className="form-badge">빠른 상담 신청</div>
                    <h2>간편 접수</h2>
                  </div>
                  <div className="alert-badge">필수 확인</div>
                </div>

                <p className="form-desc">
                  성함과 연락처를 남겨주시면 접수 확인 후 순차적으로 상담 도와드립니다.
                </p>

                <form className="form">
                  <div className="field">
                    <label>성함</label>
                    <input type="text" placeholder="성함을 입력하세요" />
                  </div>

                  <div className="field">
                    <label>연락처</label>
                    <input type="text" placeholder="연락처를 입력하세요" />
                  </div>

                  <div className="grid-2">
                    <div className="field">
                      <label>상담 구분</label>
                      <select defaultValue="직장인">
                        <option>직장인</option>
                        <option>사업자</option>
                        <option>프리랜서</option>
                        <option>기타</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>희망 상품</label>
                      <select defaultValue="아파트 담보대출">
                        <option>아파트 담보대출</option>
                        <option>주택 · 빌라 담보대출</option>
                        <option>오피스텔 담보대출</option>
                        <option>기타 상담</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label>문의 내용</label>
                    <textarea rows="4" placeholder="간단한 상담 내용을 입력하세요" />
                  </div>

                  <label className="agree-box">
                    <input type="checkbox" />
                    <span>
                      개인정보 수집 및 이용에 동의합니다. 수집 항목: 성함, 연락처,
                      문의 내용 / 수집 목적: 상담 접수 및 연락 진행
                    </span>
                  </label>

                  <button type="button" className="submit-btn">
                    상담 신청하기
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section className="container feature-wrap">
          <div className="feature-grid">
            <div className="feature-card">
              <h3>빠른 상담 연결</h3>
              <p>첫 화면에서 바로 접수할 수 있도록 폼 접근성을 높인 구조입니다.</p>
            </div>
            <div className="feature-card">
              <h3>간편한 신청 방식</h3>
              <p>필수 정보 위주로 구성해서 이탈을 줄일 수 있는 흐름입니다.</p>
            </div>
            <div className="feature-card">
              <h3>신뢰감 있는 랜딩 구성</h3>
              <p>대출 상담형 홈페이지에 어울리는 정돈된 섹션 배치입니다.</p>
            </div>
          </div>
        </section>

        <section id="products" className="section">
          <div className="container">
            <div className="section-head">
              <div className="section-mini">상품 안내</div>
              <h2>상담 가능한 상품 구성</h2>
              <p>
                참고 사이트처럼 대표 상품을 카드형으로 배치해 한눈에 보이도록 구성한 영역입니다.
              </p>
            </div>

            <div className="product-grid">
              {products.map((item) => (
                <div key={item.title} className="product-card">
                  <div className="product-badge">{item.badge}</div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                  <button className="dark-btn">상품 상담 문의</button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="section section-white">
          <div className="container">
            <div className="section-center">
              <div className="section-mini">진행 절차</div>
              <h2>상담은 이렇게 진행됩니다</h2>
            </div>

            <div className="step-grid">
              {steps.map((step, idx) => (
                <div key={step} className="step-card">
                  <div className="step-number">{idx + 1}</div>
                  <h3>{step}</h3>
                  <p>실제 운영 시 단계별 설명 문구를 추가해서 사용할 수 있습니다.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="section">
          <div className="container faq-wrap">
            <div className="section-center">
              <div className="section-mini">FAQ</div>
              <h2>자주 묻는 질문</h2>
            </div>

            <div className="faq-list">
              {faq.map((item) => (
                <details key={item.q} className="faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="container">
            <div className="cta-box">
              <div>
                <div className="section-mini cta-mini">빠른 상담 CTA</div>
                <h2>지금 바로 간편 상담을 신청해보세요</h2>
                <p>
                  참고 사이트처럼 하단에서도 다시 한 번 강하게 상담 신청을
                  유도할 수 있도록 만든 영역입니다.
                </p>
              </div>
              <a href="#contact" className="btn btn-white">상담 신청하러 가기</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <div className="footer-title">회사명 또는 브랜드명</div>
            <p>
              이 영역은 실제 운영 시 사업자 정보, 업체 설명, 안내 문구를 정리해서 넣는 공간입니다.
            </p>
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