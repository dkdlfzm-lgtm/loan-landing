import { NextResponse } from "next/server";

const API_BASE = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do";

const PROPERTY_CONFIG = {
  "아파트": {
    label: "아파트",
    statblId: process.env.REB_APT_STATBL_ID || "",
    fallbackValue: "8억 7,500만원",
    fallbackRange: "8억 3,000만원 ~ 8억 9,000만원",
    fallbackLimit: "최대 6억 1,000만원 가능",
  },
  "오피스텔": {
    label: "오피스텔",
    statblId: process.env.REB_OFFICETEL_STATBL_ID || process.env.REB_OPST_STATBL_ID || "",
    fallbackValue: "3억 2,000만원",
    fallbackRange: "3억 500만원 ~ 3억 4,000만원",
    fallbackLimit: "최대 2억 2,000만원 가능",
  },
  "빌라(연립/다세대)": {
    label: "빌라(연립/다세대)",
    statblId: process.env.REB_VILLA_STATBL_ID || "",
    fallbackValue: "4억 1,500만원",
    fallbackRange: "3억 9,000만원 ~ 4억 3,000만원",
    fallbackLimit: "최대 2억 9,000만원 가능",
  },
};

function getRowsFromPayload(data) {
  if (!data) return [];
  if (Array.isArray(data?.SttsApiTblData)) {
    for (const part of data.SttsApiTblData) {
      if (Array.isArray(part?.row)) return part.row;
    }
  }
  if (Array.isArray(data?.row)) return data.row;
  return [];
}

function rowText(row) {
  return Object.values(row || {})
    .filter((v) => typeof v === "string" || typeof v === "number")
    .join(" ")
    .toLowerCase();
}

function parseNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function formatKrwFromNumber(value) {
  if (!Number.isFinite(value)) return null;
  const eok = Math.floor(value / 100000000);
  const rest = value % 100000000;
  const man = Math.round(rest / 10000);
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString("ko-KR")}만원`;
  if (eok > 0) return `${eok}억원`;
  return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
}

function latestDate(rows) {
  const dates = rows
    .map((row) => String(row.WRTTIME_IDTFR_ID || row.BASE_DE || row.BASE_YYMM || row.TRD_DE || ""))
    .filter(Boolean)
    .sort();
  return dates.at(-1) || null;
}

function pickNumericRows(rows) {
  return rows
    .map((row) => {
      const num = parseNumber(row.DTA_VAL ?? row.value ?? row.AMT ?? row.PRICE ?? row.TRD_AMT);
      return num == null ? null : { row, num };
    })
    .filter(Boolean);
}

function buildFallback(params, reason) {
  const property = PROPERTY_CONFIG[params.propertyType] || PROPERTY_CONFIG["아파트"];
  return {
    ok: true,
    source: "fallback",
    reason,
    summary: {
      title: params.apartment || params.propertyType,
      address: `${params.city || ""} ${params.district || ""} ${params.town || ""}`.trim(),
      area: params.area || "면적 선택",
      latestPrice: property.fallbackValue,
      range: property.fallbackRange,
      estimateLimit: property.fallbackLimit,
      tradeDate: "API 연결 전 예시값",
      description: "한국부동산원 API 연결 구조는 적용되어 있으며, 인증키·통계표 ID가 설정되면 실제 값으로 자동 대체됩니다.",
    },
    trend: [],
    rawCount: 0,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const params = {
    propertyType: searchParams.get("propertyType") || "아파트",
    city: searchParams.get("city") || "",
    district: searchParams.get("district") || "",
    town: searchParams.get("town") || "",
    apartment: searchParams.get("apartment") || "",
    area: searchParams.get("area") || "",
  };

  const apiKey = process.env.REB_OPENAPI_KEY || "";
  const property = PROPERTY_CONFIG[params.propertyType] || PROPERTY_CONFIG["아파트"];

  if (!apiKey || !property.statblId) {
    return NextResponse.json(buildFallback(params, "missing_env"));
  }

  const query = new URLSearchParams({
    KEY: apiKey,
    Type: "json",
    STATBL_ID: property.statblId,
    pIndex: "1",
    pSize: "300",
  });

  try {
    const response = await fetch(`${API_BASE}?${query.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(buildFallback(params, `http_${response.status}`));
    }

    const data = await response.json();
    const rows = getRowsFromPayload(data);

    if (!rows.length) {
      return NextResponse.json(buildFallback(params, "empty_rows"));
    }

    const searchTokens = [params.city, params.district, params.town, params.apartment]
      .filter(Boolean)
      .map((token) => token.toLowerCase());

    const matchedRows = searchTokens.length
      ? rows.filter((row) => searchTokens.every((token) => rowText(row).includes(token)))
      : rows;

    const numericRows = pickNumericRows(matchedRows.length ? matchedRows : rows);

    if (!numericRows.length) {
      return NextResponse.json(buildFallback(params, "no_numeric_rows"));
    }

    const latestKey = latestDate(numericRows.map((item) => item.row));
    const latestRows = latestKey
      ? numericRows.filter((item) => {
          const key = String(
            item.row.WRTTIME_IDTFR_ID || item.row.BASE_DE || item.row.BASE_YYMM || item.row.TRD_DE || ""
          );
          return key === latestKey;
        })
      : numericRows;

    const latestValues = latestRows.map((item) => item.num);
    const averageValue = latestValues.reduce((sum, value) => sum + value, 0) / latestValues.length;
    const minValue = Math.min(...latestValues);
    const maxValue = Math.max(...latestValues);
    const estimatedLimit = Math.round(averageValue * 0.7);

    const trend = numericRows
      .slice(-6)
      .map((item) => ({
        date: String(item.row.WRTTIME_IDTFR_ID || item.row.BASE_DE || item.row.BASE_YYMM || item.row.TRD_DE || "-") ,
        value: item.num,
        label: formatKrwFromNumber(item.num) || `${item.num.toLocaleString("ko-KR")}`,
      }));

    return NextResponse.json({
      ok: true,
      source: "reb",
      statblId: property.statblId,
      summary: {
        title: params.apartment || params.propertyType,
        address: `${params.city || ""} ${params.district || ""} ${params.town || ""}`.trim(),
        area: params.area || "면적 선택",
        latestPrice: formatKrwFromNumber(Math.round(averageValue)) || property.fallbackValue,
        range: `${formatKrwFromNumber(minValue) || minValue} ~ ${formatKrwFromNumber(maxValue) || maxValue}`,
        estimateLimit: `${formatKrwFromNumber(estimatedLimit) || estimatedLimit} 가능`,
        tradeDate: latestKey || "최신 기준",
        description: `한국부동산원 Open API 통계값을 기준으로 조회한 결과입니다. 선택한 지역과 단지명이 포함된 행을 우선 필터링하고, 최신 시점 값으로 요약했습니다.`,
      },
      trend,
      rawCount: matchedRows.length || rows.length,
    });
  } catch (error) {
    return NextResponse.json(buildFallback(params, error?.message || "unknown_error"));
  }
}
