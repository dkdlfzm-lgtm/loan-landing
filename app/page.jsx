"use client";

import { useEffect, useMemo, useState } from "react";

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

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

export default function LoanLandingPage() {
  const [loanAmount, setLoanAmount] = useState("30000000");
  const [interestRate, setInterestRate] = useState("5.5");
  const [repaymentType, setRepaymentType] = useState("원리금균등");
  const [loanMonths, setLoanMonths] = useState("36");

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

  const [showPricePage, setShowPricePage] = useState(false);
  const [currentView, setCurrentView] = useState("home");

  useEffect(() => {
    const nextDistricts = Object.keys(propertyData[selectedCity] || {});
    const nextDistrict = nextDistricts[0] || "";
    setSelectedDistrict(nextDistrict);
  }, [selectedCity]);

  useEffect(() => {
    const nextTowns = Object.keys(propertyData[selectedCity]?.[selectedDistrict] || {});
    const nextTown = nextTowns[0] || "";
    setSelectedTown(nextTown);
  }, [selectedCity, selectedDistrict]);

  useEffect(() => {
    const nextApartments = Object.keys(
      propertyData[selectedCity]?.[selectedDistrict]?.[selectedTown] || {}
    );
    const nextApartment = nextApartments[0] || "";
    setSelectedApartment(nextApartment);
  }, [selectedCity, selectedDistrict, selectedTown]);

  useEffect(() => {
    const nextAreas =
      propertyData[selectedCity]?.[selectedDistrict]?.[selectedTown]?.[selectedApartment] || [];
    setSelectedArea(nextAreas[0] || "");
  }, [selectedCity, selectedDistrict, selectedTown, selectedApartment]);

  const selectedSummary = `${selectedCity} ${selectedDistrict} ${selectedTown} ${selectedApartment}`;

  const priceResult = useMemo(() => {
    const title = selectedApartment || "선택 단지";
    const area = selectedArea || "84.96㎡";
    return {
      title,
      address: `${selectedCity} ${selectedDistrict} ${selectedTown}`,
      area,
      floor: "101동 12층",
      tradeDate: "2026.03.18",
      latestPrice: "8억 7,500만원",
      range: "8억 3,000만원 ~ 8억 9,000만원",
      estimateLimit: "최대 6억 1,000만원 가능",
      description:
        "최근 실거래 기준 예시 결과입니다. 실제 운영 시에는 국토교통부 실거래가 API 및 단지/면적 마스터 데이터를 연결해 자동 조회되도록 확장할 수 있습니다.",
    };
  }, [selectedApartment, selectedArea, selectedCity, selectedDistrict, selectedTown]);

  const calcResult = useMemo(() => {
    const principal = Number(String(loanAmount).replace(/,/g, ""));
    const annualRate = Number(interestRate);
    const months = Number(loanMonths);

    if (!principal || !annualRate || !months || months <= 0) {
      return {
        monthlyPayment: 0,
        totalInterest: 0,
        totalPayment: 0,
      };
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

    return {
      monthlyPayment,
      totalInterest,
      totalPayment,
    };
  }, [loanAmount, interestRate, repaymentType, loanMonths]);

  const faq = [
    {
      q: "시세조회 후 바로 대출 상담도 가능한가요?",
      a: "네. 조회 결과 하단 또는 별도 상담 신청 영역에서 바로 접수할 수 있게 구성했습니다.",
    },
    {
      q: "조회 결과는 실제와 완전히 동일한가요?",
      a: "현재는 시안 기준이며, 실제 운영 시 공공 API와 내부 심사 기준을 반영해 구체화할 수 있습니다.",
    },
    {
      q: "이율 계산기는 실시간으로 바뀌나요?",
      a: "네. 입력값에 따라 예상 상환액, 총이자, 총상환액이 즉시 변경됩니다.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-lg font-bold text-white shadow-md">
              대
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight">대출상담 브랜드명</div>
              <div className="text-xs text-slate-500">빠른 상담 접수 랜딩페이지</div>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-700 md:flex">
            <a href="#intro" className="transition hover:text-blue-700">홈</a>
            <a href="#quick-search" className="transition hover:text-blue-700">시세조회</a>
            <a href="#calculator" className="transition hover:text-blue-700">이율계산기</a>
            <a href="#contact" className="rounded-full bg-blue-700 px-5 py-2.5 text-white shadow-sm transition hover:bg-blue-800">
              상담 신청
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section
          id="intro"
          className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_35%),linear-gradient(135deg,#0f2f75_0%,#0e58c7_55%,#0b74f0_100%)] text-white"
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute left-[-120px] top-[-80px] h-72 w-72 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-[-120px] right-[-80px] h-80 w-80 rounded-full bg-cyan-300 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
            <div>
              <div className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur">
                선택형 시세조회 · 빠른 상담 연결
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
                아파트 시세조회부터
                <br />
                대출 상담 신청까지
                <br />
                한 번에 연결되는 구조
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-blue-50 md:text-lg">
                지역, 단지명, 면적을 차례대로 선택하고 조회를 누르면 결과형 페이지처럼
                설명 영역과 상담 신청란이 이어지는 구조로 만든 시안입니다.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#quick-search" className="rounded-full bg-white px-7 py-3.5 text-sm font-bold text-blue-800 shadow-xl transition hover:scale-[1.02]">
                  빠른 시세조회
                </a>
                <a href="#contact" className="rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">
                  무료 상담 신청
                </a>
              </div>
            </div>

            <div className="rounded-[30px] bg-white p-7 text-slate-900 shadow-[0_30px_80px_rgba(0,0,0,0.25)] md:p-8">
              <div className="text-sm font-bold text-blue-700">빠른 상담 신청</div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">간편 접수</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                성함과 연락처를 남겨주시면 접수 확인 후 순차적으로 상담 도와드립니다.
              </p>

              <form className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">성함</label>
                  <input type="text" placeholder="성함을 입력하세요" className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-blue-500 focus:bg-white" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">연락처</label>
                  <input type="text" placeholder="연락처를 입력하세요" className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-blue-500 focus:bg-white" />
                </div>
                <button type="button" className="w-full rounded-2xl bg-blue-700 px-5 py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-blue-800">
                  상담 신청하기
                </button>
              </form>
            </div>
          </div>
        </section>

        <section id="quick-search" className="mx-auto max-w-7xl px-6 py-16 md:py-20">
          <div className="rounded-[34px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] md:p-8">
            <div className="text-center">
              <div className="text-sm font-bold text-blue-700">빠른 시세조회</div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                오늘의 아파트 대출이 궁금하세요?
              </h2>
            </div>

            <div className="mt-8 rounded-[28px] bg-[linear-gradient(135deg,#0e49b5_0%,#0d63de_100%)] p-5 text-white md:p-7">
              <div className="grid gap-3 md:grid-cols-3">
                <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="rounded-2xl border border-white/30 bg-white/10 px-4 py-4 text-sm font-bold text-white outline-none backdrop-blur">
                  {cities.map((city) => (
                    <option key={city} value={city} className="text-slate-900">{city}</option>
                  ))}
                </select>

                <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} className="rounded-2xl border border-white/30 bg-white/10 px-4 py-4 text-sm font-bold text-white outline-none backdrop-blur">
                  {districts.map((district) => (
                    <option key={district} value={district} className="text-slate-900">{district}</option>
                  ))}
                </select>

                <select value={selectedTown} onChange={(e) => setSelectedTown(e.target.value)} className="rounded-2xl border border-white/30 bg-white/10 px-4 py-4 text-sm font-bold text-white outline-none backdrop-blur">
                  {towns.map((town) => (
                    <option key={town} value={town} className="text-slate-900">{town}</option>
                  ))}
                </select>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_160px]">
                <select value={selectedApartment} onChange={(e) => setSelectedApartment(e.target.value)} className="rounded-2xl border border-white/30 bg-white/10 px-4 py-4 text-sm font-bold text-white outline-none backdrop-blur">
                  {apartments.map((apartment) => (
                    <option key={apartment} value={apartment} className="text-slate-900">{apartment}</option>
                  ))}
                </select>

                <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="rounded-2xl border border-white/30 bg-white/10 px-4 py-4 text-sm font-bold text-white outline-none backdrop-blur">
                  {areas.map((area) => (
                    <option key={area} value={area} className="text-slate-900">{area}</option>
                  ))}
                </select>

                <button type="button" onClick={() => {
                    setShowPricePage(true);
                    setCurrentView("price-result");
                  }} className="rounded-2xl bg-white px-5 py-4 text-sm font-extrabold text-blue-800 transition hover:opacity-95">
                  실시간 조회
                </button>
              </div>

              <div className="mt-4 text-sm text-blue-50">
                선택 중: <span className="font-extrabold">{selectedSummary}</span> / <span className="font-extrabold">{selectedArea}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-14">
          <div className="grid gap-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] md:grid-cols-3">
            <div className="border-b border-slate-200 p-8 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-extrabold tracking-tight">공지사항</h3>
                <a href="#" className="text-sm font-bold text-blue-700">더보기 →</a>
              </div>
              <div className="mt-6 space-y-4 text-sm text-slate-700">
                {[
                  ["공지사항 1", "2026.03.16"],
                  ["공지사항 2", "2026.03.15"],
                  ["공지사항 3", "2026.03.14"],
                  ["공지사항 4", "2026.03.13"],
                  ["공지사항 5", "2026.03.12"],
                ].map(([title, date]) => (
                  <div key={title} className="flex items-center justify-between gap-4 border-b border-dashed border-slate-200 pb-3 last:border-b-0 last:pb-0">
                    <span className="truncate">{title}</span>
                    <span className="shrink-0 text-slate-400">{date}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-slate-200 p-8 text-center md:border-b-0 md:border-r">
              <div className="text-2xl font-extrabold tracking-tight">무료상담문의</div>
              <div className="mt-6 text-5xl font-black tracking-tight text-slate-900">0000-0000</div>
              <div className="mt-3 text-3xl font-medium tracking-tight text-slate-700">000-0000-0000</div>
              <div className="mt-5 text-base font-bold text-blue-700">상담시간 입력칸</div>
            </div>

            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3b1d1d] text-2xl font-black text-yellow-300 shadow-md">
                TALK
              </div>
              <div className="mt-5 text-xl font-bold text-slate-700">카카오톡 상담 예시</div>
              <div className="mt-2 text-5xl font-black tracking-tight text-[#401717]">아이디칸</div>
            </div>
          </div>
        </section>

        <section className="bg-[#f3f3f3] py-16 md:py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.38fr_0.62fr]">
            <div>
              <div className="text-5xl font-black tracking-tight text-slate-900">대출후기</div>
              <a href="#" className="mt-8 inline-block text-lg font-bold text-blue-700">더보기 →</a>
            </div>

            <div className="space-y-5">
              {[
                ["후기 제목 예시 1", "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.", "2026.03.20"],
                ["후기 제목 예시 2", "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.", "2026.03.19"],
                ["후기 제목 예시 3", "후기 내용이 들어가는 자리입니다. 시안용으로 간단한 예시 문구를 배치했습니다.", "2026.03.17"],
              ].map(([title, desc, date]) => (
                <div key={title} className="rounded-[28px] bg-white p-7 shadow-[0_10px_26px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-2xl font-bold tracking-tight text-slate-900">{title}</div>
                      <div className="mt-4 truncate text-lg text-slate-500">{desc}</div>
                    </div>
                    <div className="shrink-0 text-2xl font-medium tracking-tight text-blue-600">{date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#4b4b4b] py-14 text-[#d8d0c4] md:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="space-y-4 text-[18px] leading-[1.8] md:text-[22px]">
              <div>이자율 : 연6% ~ 연20%이내 (연체이자율 연 7% ~ 20% 이내, 취급수수료 및 기타 부대비용없음)</div>
              <div>중개수수료를 요구하거나 받는 것은 불법입니다.</div>
              <div>과도한 빚, 고통의 시작입니다. 대출시 귀하의 신용등급이 하락할 수 있습니다.</div>
              <div>이 사이트에서 광고되는 상품들의 상환 기간은 모두 60일 이상이며 (최저 2개월, 최대 5년), 최대 연 이자율은 20%입니다.</div>
              <div>대부이자율 (연 이자율) 및 연체이자율은 연 20%를 초과할 수 없습니다. (조기상환 조건없음)</div>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sm font-medium text-[#d8d0c4] md:text-[18px]">
              <span>상호명 : 서준컨설팅대부</span>
              <span>사업자등록번호 306-08-26433</span>
              <span>사업장소재지 : 경기도의정부시 신흥로258번길 25, 헤테프라자 8층 A05호</span>
              <span>대표자명 : 최성미</span>
              <span>광고등록번호 : 0000-0000 / 000-0000-0000</span>
              <span>대부업등록기관 : 경기도 의정부시 기업경제과 031-828-2917</span>
              <span>대부업번호 : 2022-경기의정부-0075-대부</span>
            </div>

            <div className="mt-10 text-sm text-[#d8d0c4] md:text-[18px]">
              © 서준컨설팅대부. All Rights Reserved. Hosting by AD COMMUNICATION.
            </div>
          </div>
        </section>

        {showPricePage && (
          <section className="bg-white py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-blue-700">조회 결과</div>
                      <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                        {priceResult.title}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
                        {priceResult.address} · {priceResult.area} · {priceResult.floor}
                      </p>
                    </div>
                    <a href="#contact" className="rounded-full bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-800">
                      상담 신청
                    </a>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="text-xs font-medium text-slate-500">최근 실거래가</div>
                      <div className="mt-2 text-xl font-extrabold text-slate-900">{priceResult.latestPrice}</div>
                      <div className="mt-1 text-xs text-slate-500">기준일 {priceResult.tradeDate}</div>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="text-xs font-medium text-slate-500">최근 거래 범위</div>
                      <div className="mt-2 text-xl font-extrabold text-slate-900">{priceResult.range}</div>
                      <div className="mt-1 text-xs text-slate-500">최근 조회 기준</div>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="text-xs font-medium text-slate-500">전용면적 / 층</div>
                      <div className="mt-2 text-xl font-extrabold text-slate-900">{priceResult.area}</div>
                      <div className="mt-1 text-xs text-slate-500">{priceResult.floor}</div>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="text-xs font-medium text-slate-500">예상 가능 한도</div>
                      <div className="mt-2 text-xl font-extrabold text-slate-900">{priceResult.estimateLimit}</div>
                      <div className="mt-1 text-xs text-slate-500">상담 후 세부조건 반영</div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[26px] bg-white p-6 shadow-sm">
                    <div className="text-sm font-bold text-blue-700">설명 영역</div>
                    <h3 className="mt-2 text-2xl font-extrabold tracking-tight">
                      선택하신 단지를 기준으로 대출 상담을 도와드립니다.
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
                      {priceResult.description}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">{selectedCity}</span>
                      <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">{selectedDistrict}</span>
                      <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">{selectedTown}</span>
                      <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">{selectedApartment}</span>
                      <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">{selectedArea}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div id="contact" className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <div className="text-sm font-bold text-blue-700">대출 신청 작성란</div>
                    <h3 className="mt-2 text-3xl font-extrabold tracking-tight">지금 바로 상담 신청</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
                      조회하신 단지 정보를 바탕으로 담당자가 빠르게 상담드릴 수 있도록 작성란을 함께 배치한 구조입니다.
                    </p>

                    <form className="mt-6 space-y-4">
                      <input type="text" placeholder="성함" className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 outline-none" />
                      <input type="text" placeholder="연락처" className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 outline-none" />
                      <input type="text" value={`${selectedApartment} / ${selectedArea}`} readOnly className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3.5 outline-none" />
                      <select className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 outline-none">
                        <option>희망 상품 선택</option>
                        <option>아파트 담보대출</option>
                        <option>생활안정자금</option>
                        <option>대환대출</option>
                      </select>
                      <textarea rows={4} placeholder="상담 내용을 입력하세요" className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 outline-none" />
                      <button type="button" className="w-full rounded-2xl bg-blue-700 px-5 py-4 text-base font-extrabold text-white transition hover:bg-blue-800">
                        대출 신청 접수하기
                      </button>
                    </form>
                  </div>

                  <div id="calculator" className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <div className="text-sm font-bold text-blue-700">이율 계산기</div>
                    <h3 className="mt-2 text-2xl font-extrabold tracking-tight">예상 상환 금액 계산</h3>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="대출 금액"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(e.target.value.replace(/[^0-9]/g, ""))}
                        className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="연 이율(%)"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9.]/g, ""))}
                        className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none"
                      />
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <select value={repaymentType} onChange={(e) => setRepaymentType(e.target.value)} className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none">
                        <option>원리금균등</option>
                        <option>원금균등</option>
                        <option>만기일시상환</option>
                      </select>
                      <input
                        type="text"
                        placeholder="기간(개월)"
                        value={loanMonths}
                        onChange={(e) => setLoanMonths(e.target.value.replace(/[^0-9]/g, ""))}
                        className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none"
                      />
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white">
                      <div className="text-sm text-slate-300">예상 월 상환액</div>
                      <div className="mt-2 text-3xl font-extrabold tracking-tight">
                        {formatNumber(calcResult.monthlyPayment)}원
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                        <div className="rounded-xl bg-white/5 p-3">
                          <div className="text-xs text-slate-400">총 예상 이자</div>
                          <div className="mt-1 text-base font-bold text-white">
                            {formatNumber(calcResult.totalInterest)}원
                          </div>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3">
                          <div className="text-xs text-slate-400">총 상환 예상액</div>
                          <div className="mt-1 text-base font-bold text-white">
                            {formatNumber(calcResult.totalPayment)}원
                          </div>
                        </div>
                      </div>
                    </div>

                    <a href="#contact" className="mt-4 flex items-center justify-center rounded-2xl bg-blue-700 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-blue-800">
                      계산 후 상담 신청
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="faq" className="mx-auto max-w-5xl px-6 py-16 md:py-24">
          <div className="text-center">
            <div className="text-sm font-bold text-blue-700">FAQ</div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">자주 묻는 질문</h2>
          </div>

          <div className="mt-10 space-y-4">
            {faq.map((item) => (
              <details key={item.q} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
                <summary className="cursor-pointer list-none text-lg font-bold tracking-tight">
                  {item.q}
                </summary>
                <p className="mt-4 text-sm leading-6 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-[#0b1220] text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="text-lg font-extrabold text-white">회사명 또는 브랜드명</div>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              이 영역은 실제 운영 시 사업자 정보, 업체 설명, 안내 문구를 정리해서 넣는 공간입니다.
            </p>
          </div>
          <div className="grid gap-2 text-sm leading-7 text-slate-400">
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
