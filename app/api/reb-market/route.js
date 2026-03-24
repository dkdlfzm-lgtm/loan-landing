import { NextResponse } from "next/server";

const REB_OPENAPI_KEY = process.env.REB_OPENAPI_KEY || "";
const REB_APT_STATBL_ID = process.env.REB_APT_STATBL_ID || "";
const REB_OFFICETEL_STATBL_ID = process.env.REB_OFFICETEL_STATBL_ID || "";
const REB_VILLA_STATBL_ID = process.env.REB_VILLA_STATBL_ID || "";

function getStatblId(propertyType) {
  if (propertyType === "아파트") return REB_APT_STATBL_ID;
  if (propertyType === "오피스텔") return REB_OFFICETEL_STATBL_ID;
  return REB_VILLA_STATBL_ID;
}

function buildFallbackResult(searchParams) {
  const propertyType = searchParams.get("propertyType") || "아파트";
  const city = searchParams.get("city") || "";
  const district = searchParams.get("district") || "";
  const town = searchParams.get("town") || "";
  const apartment = searchParams.get("apartment") || "";
  const area = searchParams.get("area") || "";

  return {
    ok: true,
    source: "fallback",
    propertyType,
    address: [city, district, town, apartment].filter(Boolean).join(" "),
    area,
    latestPrice: "확인중",
    priceRange: "확인중",
    estimateLimit: "상담 문의",
    monthlyInterest: "상담 문의",
    statblId: getStatblId(propertyType),
    message: "실제 REB 응답 연결 전 fallback 데이터입니다.",
  };
}

async function fetchRebData(statblId) {
  if (!REB_OPENAPI_KEY || !statblId) {
    return null;
  }

  const baseUrl = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do";

  const url = new URL(baseUrl);
  url.searchParams.set("KEY", REB_OPENAPI_KEY);
  url.searchParams.set("STATBL_ID", statblId);
  url.searchParams.set("DTACYCLE_CD", "MM");
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "10");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`REB API 요청 실패: ${res.status}`);
  }

  return await res.json();
}

function extractDisplayValue(rebJson) {
  if (!rebJson) return null;

  const candidates = [];

  if (Array.isArray(rebJson)) candidates.push(...rebJson);
  if (Array.isArray(rebJson?.SttsApiTblData)) candidates.push(...rebJson.SttsApiTblData);
  if (Array.isArray(rebJson?.DATA)) candidates.push(...rebJson.DATA);
  if (Array.isArray(rebJson?.data)) candidates.push(...rebJson.data);

  const first = candidates[0];
  if (!first || typeof first !== "object") return null;

  return {
    latestPrice:
      first.WRTTIME_DESC ||
      first.BASE_MM ||
      first.BASE_YM ||
      first.OBJ_NM ||
      "조회됨",
    priceRange:
      first.DTVAL_CO ||
      first.VALUE ||
      first.AVG ||
      "조회됨",
    raw: first,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const propertyType = searchParams.get("propertyType") || "아파트";
    const city = searchParams.get("city") || "";
    const district = searchParams.get("district") || "";
    const town = searchParams.get("town") || "";
    const apartment = searchParams.get("apartment") || "";
    const area = searchParams.get("area") || "";

    const statblId = getStatblId(propertyType);

    if (!statblId) {
      return NextResponse.json(
        {
          ok: false,
          error: "통계표 ID가 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const rebJson = await fetchRebData(statblId).catch(() => null);
    const parsed = extractDisplayValue(rebJson);

    if (!parsed) {
      return NextResponse.json(buildFallbackResult(searchParams));
    }

    return NextResponse.json({
      ok: true,
      source: "reb",
      propertyType,
      address: [city, district, town, apartment].filter(Boolean).join(" "),
      area,
      latestPrice: parsed.latestPrice || "조회됨",
      priceRange: parsed.priceRange || "조회됨",
      estimateLimit: "상담 문의",
      monthlyInterest: "상담 문의",
      statblId,
      raw: parsed.raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "시세 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
