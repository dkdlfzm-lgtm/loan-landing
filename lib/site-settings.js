export const DEFAULT_SITE_SETTINGS = {
  scope: "main",
  company_name: "엔드아이에셋대부",
  company_subtitle: "주택담보대출 · 대환대출 · 전세퇴거자금 상담",
  logo_url: "/andi-logo.jpg",
  phone: "070-8018-7437",
  kakao_id: "ANDi7437",
  kakao_url: "https://open.kakao.com/o/sbaltXmi",
  hero_badge: "선택형 시세조회 · 빠른 상담 연결",
  hero_title: `아파트 시세조회부터
대출 상담 신청까지
한 번에 연결되는 구조`,
  hero_description: "필요한 주소 정보와 단지를 차례대로 선택하면 예상 시세와 상담 연결 화면으로 자연스럽게 이어지도록 구성한 고객용 메인 페이지입니다.",
  hero_feature_1: "무료 한도 상담",
  hero_feature_2: "빠른 접수 확인",
  hero_feature_3: "맞춤 상담 연결",
  hero_primary_cta: "빠른 시세조회",
  hero_secondary_cta: "무료 상담 신청",
  consult_button_text: "상담 신청",
  reviews_enabled: true,
  hero_background_url: "",
  notice_enabled: false,
  notice_text: "금리와 한도는 조건에 따라 달라질 수 있으니 상담을 통해 정확하게 안내해드립니다.",
  popup_enabled: false,
  popup_title: "빠른 상담 안내",
  popup_description: "대표번호 또는 카카오톡으로 문의를 남겨주시면 순차적으로 빠르게 상담을 도와드립니다.",
  popup_button_text: "상담 바로가기",
  popup_button_url: "#contact",
};

const BOOLEAN_FIELDS = new Set(["reviews_enabled", "notice_enabled", "popup_enabled"]);

export function normalizeSiteSettings(row = {}) {
  const normalized = {
    ...DEFAULT_SITE_SETTINGS,
    ...Object.fromEntries(Object.entries(row || {}).filter(([, value]) => value !== null && value !== undefined)),
  };

  for (const key of BOOLEAN_FIELDS) {
    normalized[key] = parseBoolean(normalized[key], DEFAULT_SITE_SETTINGS[key]);
  }

  return normalized;
}

export function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(lower)) return true;
    if (["false", "0", "no", "n", "off"].includes(lower)) return false;
  }
  return fallback;
}
