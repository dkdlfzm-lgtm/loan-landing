import { NextResponse } from "next/server";

const API_BASE = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do";

const PROPERTY_STAT_ID_MAP = {
  아파트: process.env.REB_APT_STATBL_ID,
  오피스텔: process.env.REB_OFFICETEL_STATBL_ID,
  "빌라(연립/다세대)": process.env.REB_VILLA_STATBL_ID,
};

function hashString(input = "") {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizePriceToWon(raw) {
  const numeric = Number(raw || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  // 한국부동산원 통계 응답은 보통 만원 단위로 내려오는 경우가 많습니다.
  // 이미 원 단위로 큰 값이 오면 그대로 사용하고, 일반적인 통계값 규모면 만원 단위로 환산합니다.
  if (numeric >= 100000000) return Math.round(numeric);
  if (numeric >= 1000) return Math.round(numeric * 10000);
  return Math.round(numeric * 100000000);
}

function formatEok(value) {
  const won = normalizePriceToWon(value);
  if (!won) return "0만원";
  const eok = Math.floor(won / 100000000);
  const rest = won % 100000000;
  const man = Math.round(rest / 10000);
  if (eok <= 0) return `${man.toLocaleString("ko-KR")}만원`;
  if (man <= 0) return `${eok}억`;
  return `${eok}억 ${man.toLocaleString("ko-KR")}만원`;
}

function buildFallbackSummary({ propertyType, city, district, town, apartment, area }) {
  const seed = hashString(`${propertyType}-${city}-${district}-${town}-${apartment}-${area}`);
  const latest = 280000000 + (seed % 950000000);
  const low = Math.max(latest - (30000000 + (seed % 35000000)), 100000000);
  const high = latest + (20000000 + (seed % 28000000));
  const limitRatio = propertyType === "아파트" ? 0.72 : propertyType === "오피스텔" ? 0.68 : 0.62;
  const limit = Math.round(latest * limitRatio);
  const weekDelta = ((seed % 31) / 100).toFixed(2);
  const weekTrend = seed % 2 === 0 ? `+${weekDelta}%` : `-${weekDelta}%`;

  return {
    title: apartment || `${town} 대표 단지`,
    address: [city, district, town].filter(Boolean).join(" "),
    area: area || "선택 면적",
    tradeDate: "최근 조회 기준",
    latestPrice: formatEok(latest),
    range: `${formatEok(low)} ~ ${formatEok(high)}`,
    estimateLimit: `최대 ${formatEok(limit)} 가능`,
    description: `${city} ${district} ${town} ${apartment} ${area} 기준으로 조회한 예시 결과입니다. 실제 한도와 금리는 소득, 보유부채, 규제지역 여부에 따라 달라질 수 있습니다.`,
    trendText: `최근 주간 흐름 ${weekTrend}`,
  };
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.SttsApiTblData)) return payload.SttsApiTblData;
  if (Array.isArray(payload?.response?.body?.items)) return payload.response.body.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function pickLatestItem(items = []) {
  if (!items.length) return null;
  return [...items].sort((a, b) => {
    const av = String(a.WRTTIME_IDTFR_ID || a.wrttimeIdtfrId || a.date || "");
    const bv = String(b.WRTTIME_IDTFR_ID || b.wrttimeIdtfrId || b.date || "");
    return bv.localeCompare(av);
  })[0];
}

function makeSummaryFromApi(item, fallback, query) {
  if (!item) return fallback;

  const rawValue =
    Number(item.DT || item.dt || item.VALUE || item.value || item.PRICE || item.price || 0);

  if (!rawValue) return fallback;

  const numericValue = normalizePriceToWon(rawValue);
  const low = Math.round(numericValue * 0.96);
  const high = Math.round(numericValue * 1.04);
  const limitRatio = query.propertyType === "아파트" ? 0.72 : query.propertyType === "오피스텔" ? 0.68 : 0.62;

  return {
    ...fallback,
    tradeDate: String(item.WRTTIME_IDTFR_ID || item.wrttimeIdtfrId || fallback.tradeDate),
    latestPrice: formatEok(numericValue),
    range: `${formatEok(low)} ~ ${formatEok(high)}`,
    estimateLimit: `최대 ${formatEok(Math.round(numericValue * limitRatio))} 가능`,
    description: `${fallback.address} ${fallback.title} 기준으로 한국부동산원 공개 통계 응답을 가공한 값입니다. 세부 단지·면적별 실거래가와는 차이가 있을 수 있어 상담 시 다시 확인이 필요합니다.`,
  };
}

async function fetchRebSummary(query, fallback) {
  const key = process.env.REB_OPENAPI_KEY;
  const statId = PROPERTY_STAT_ID_MAP[query.propertyType];

  if (!key || !statId) {
    return { summary: fallback, source: "fallback" };
  }

  const url = new URL(API_BASE);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("STATBL_ID", statId);
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "30");

  if (process.env.REB_DTACYCLE_CD) url.searchParams.set("DTACYCLE_CD", process.env.REB_DTACYCLE_CD);
  if (process.env.REB_WRTTIME_ID) url.searchParams.set("WRTTIME_IDTFR_ID", process.env.REB_WRTTIME_ID);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`R-ONE API 호출 실패 (${response.status})`);
  }

  const payload = await response.json();
  const items = normalizeItems(payload);
  return {
    summary: makeSummaryFromApi(pickLatestItem(items), fallback, query),
    source: items.length ? "reb-openapi" : "fallback",
    count: items.length,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = {
    propertyType: searchParams.get("propertyType") || "아파트",
    city: searchParams.get("city") || "",
    district: searchParams.get("district") || "",
    town: searchParams.get("town") || "",
    apartment: searchParams.get("apartment") || "",
    area: searchParams.get("area") || "",
  };

  if (!query.city || !query.district || !query.town || !query.apartment || !query.area) {
    return NextResponse.json(
      { ok: false, message: "시도, 시군구, 읍면동, 아파트, 면적을 모두 선택해 주세요." },
      { status: 400 }
    );
  }

  const fallback = buildFallbackSummary(query);

  try {
    const result = await fetchRebSummary(query, fallback);
    return NextResponse.json({ ok: true, ...result, query });
  } catch (error) {
    return NextResponse.json(
      {
        ok: true,
        source: "fallback",
        summary: fallback,
        query,
        warning: error?.message || "외부 시세 API를 불러오지 못해 예시 데이터를 표시합니다.",
      },
      { status: 200 }
    );
  }
}
