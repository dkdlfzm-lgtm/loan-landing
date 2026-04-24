import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MEMORY_TTL_MS = 1000 * 60 * 30;
const VALID_LEVELS = new Set(["city", "district", "town", "apartment", "area"]);
const BAD_CITY_PATTERN = /[,，]/;

globalThis.__PROPERTY_CATALOG_FAST_CACHE__ ||= new Map();

function jsonFast(body, init = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  return response;
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function encodeFilter(value) {
  return `eq.${value}`;
}

function sortKo(values = []) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function emptyResult(query, warning = "") {
  return {
    ok: true,
    source: "property_catalog_options",
    query,
    options: { cities: [], districts: [], towns: [], apartments: [], areas: [] },
    counts: { cities: 0, districts: 0, towns: 0, apartments: 0, areas: 0 },
    warning,
  };
}

function getCache(key) {
  const item = globalThis.__PROPERTY_CATALOG_FAST_CACHE__.get(key);
  if (!item) return null;
  if (Date.now() - item.createdAt > MEMORY_TTL_MS) {
    globalThis.__PROPERTY_CATALOG_FAST_CACHE__.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value) {
  globalThis.__PROPERTY_CATALOG_FAST_CACHE__.set(key, { createdAt: Date.now(), value });
}

function normalizeQuery(searchParams) {
  return {
    propertyType: cleanText(searchParams.get("propertyType") || "아파트"),
    city: cleanText(searchParams.get("city") || ""),
    district: cleanText(searchParams.get("district") || ""),
    town: cleanText(searchParams.get("town") || ""),
    apartment: cleanText(searchParams.get("apartment") || ""),
    area: cleanText(searchParams.get("area") || ""),
  };
}

function nextLevel(query) {
  if (!query.city) return "city";
  if (!query.district) return "district";
  if (!query.town) return "town";
  if (!query.apartment) return "apartment";
  return "area";
}

function buildParentFilters(level, query) {
  const filters = {
    select: "option_level,label,city,district,town,apartment,area,sort_value",
    property_type: encodeFilter("아파트"),
    option_level: encodeFilter(level),
    order: level === "area" ? "sort_value.asc,label.asc" : "label.asc",
    limit: "5000",
  };

  if (["district", "town", "apartment", "area"].includes(level)) filters.city = encodeFilter(query.city);
  if (["town", "apartment", "area"].includes(level)) filters.district = encodeFilter(query.district);
  if (["apartment", "area"].includes(level)) filters.town = encodeFilter(query.town);
  if (level === "area") filters.apartment = encodeFilter(query.apartment);

  return filters;
}

async function fetchOptionLabels(level, query) {
  if (!VALID_LEVELS.has(level)) return [];
  const rows = await supabaseRest("/property_catalog_options", {
    query: buildParentFilters(level, query),
  });

  const labels = Array.isArray(rows)
    ? rows.map((row) => cleanText(row.label)).filter(Boolean)
    : [];

  // DB에 잘못 들어간 "충청남도, 충청북도" 같은 값은 화면에서 제외
  if (level === "city") return sortKo([...new Set(labels.filter((v) => !BAD_CITY_PATTERN.test(v)))]);
  return [...new Set(labels)];
}

function buildResponse(query, level, labels, cacheState) {
  const options = { cities: [], districts: [], towns: [], apartments: [], areas: [] };
  if (level === "city") options.cities = labels;
  if (level === "district") options.districts = labels;
  if (level === "town") options.towns = labels;
  if (level === "apartment") options.apartments = labels;
  if (level === "area") options.areas = labels;

  return {
    ok: true,
    source: "property_catalog_options",
    cache: cacheState,
    query: {
      city: query.city,
      district: query.district,
      town: query.town,
      apartment: query.apartment,
      area: query.area,
    },
    options,
    counts: {
      cities: options.cities.length,
      districts: options.districts.length,
      towns: options.towns.length,
      apartments: options.apartments.length,
      areas: options.areas.length,
    },
    debug: {
      mode: "fast-options-table",
      fetched_rows: labels.length,
      level,
      note: "원본 apartment_trade_cache 전체 스캔 없이 property_catalog_options만 조회합니다.",
    },
    warning: labels.length === 0
      ? "조건에 맞는 옵션이 없습니다. /api/admin/property-catalog-options/rebuild 실행 또는 Supabase SQL 재생성을 확인하세요."
      : "",
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams);

  try {
    if (query.propertyType !== "아파트") {
      return jsonFast(emptyResult(
        { city: "", district: "", town: "", apartment: "", area: "" },
        "현재 드롭다운 제한은 아파트 실거래가 기준으로만 적용됩니다."
      ));
    }

    if (!isSupabaseConfigured()) {
      return jsonFast(
        { ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const level = nextLevel(query);
    const cacheKey = JSON.stringify({ level, city: query.city, district: query.district, town: query.town, apartment: query.apartment });
    const cached = getCache(cacheKey);
    if (cached) return jsonFast(buildResponse(query, level, cached, "hit"));

    const labels = await fetchOptionLabels(level, query);
    setCache(cacheKey, labels);

    return jsonFast(buildResponse(query, level, labels, "miss"));
  } catch (error) {
    const message = error?.message || "단지 목록을 불러오지 못했습니다.";
    const isMissingTable = /property_catalog_options|schema cache|relation/i.test(message);
    return jsonFast(
      {
        ok: false,
        message: isMissingTable
          ? "빠른 조회용 property_catalog_options 테이블이 아직 없습니다. supabase/fast-catalog/01_property_catalog_options.sql 파일을 Supabase SQL Editor에서 먼저 실행하세요."
          : message,
      },
      { status: 500 }
    );
  }
}
