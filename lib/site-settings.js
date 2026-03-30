export const DEFAULT_SITE_SETTINGS = {
  scope: "main",
  company_name: "엔드아이에셋대부",
  company_subtitle: "주택담보대출 · 대환대출 · 전세퇴거자금 상담",
  phone: "070-8018-7437",
  kakao_id: "ANDi7437",
  kakao_url: "https://open.kakao.com/o/sbaltXmi",
  hero_badge: "선택형 시세조회 · 빠른 상담 연결",
  hero_title: `아파트 시세조회부터
대출 상담 신청까지
한 번에 연결되는 구조`,
  hero_description: "필요한 주소 정보와 단지를 차례대로 선택하면 예상 시세와 상담 연결 화면으로 자연스럽게 이어지도록 구성한 고객용 메인 페이지입니다.",
  hero_primary_cta: "빠른 시세조회",
  hero_secondary_cta: "무료 상담 신청",
  consult_button_text: "상담 신청",
};

export function normalizeSiteSettings(row = {}) {
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...Object.fromEntries(Object.entries(row || {}).filter(([, value]) => value !== null && value !== undefined)),
  };
}
