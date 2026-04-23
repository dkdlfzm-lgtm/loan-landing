import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body, init = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function sortKo(values = []) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function normalizeAreaValue(area) {
  const match = String(area ?? "").match(/\d+(?:\.\d+)?/);
  if (!match) return "";
  const num = Number(match[0]);
  if (!Number.isFinite(num) || num <= 0) return "";
  return `${Number(num.toFixed(2))}㎡`;
}

function sortAreas(values = []) {
  return uniq(values.map(normalizeAreaValue)).sort((a, b) => {
    const an = Number(String(a).replace(/㎡/g, ""));
    const bn = Number(String(b).replace(/㎡/g, ""));
    return an - bn;
  });
}

async function fetchCursorPagedRows(extraFilters = {}, pageSize = 1000, maxPages = 200) {
  const all = [];
  let lastId = 0;
  let pages = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const query = {
      select: "id,city,district,town,apartment_name,area_m2,deal_date,amount_won",
      property_type: "eq.아파트",
      amount_won: "gt.0",
      order: "id.asc",
      limit: String(pageSize),
      ...extraFilters,
    };

    if (lastId > 0) {
      query.id = `gt.${lastId}`;
    }

    const rows = await supabaseRest("/apartment_trade_cache", { query });
    const batch = Array.isArray(rows) ? rows : [];
    pages += 1;

    if (!batch.length) break;

    all.push(...batch);
    lastId = Number(batch[batch.length - 1]?.id || lastId);

    if (batch.length < pageSize) break;
  }

  return { rows: all, pages, lastId };
}

async function fetchCacheRows(query) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }

  if (!query.city) {
    return fetchCursorPagedRows({});
  }

  if (!query.district) {
    return fetchCursorPagedRows({ city: `eq.${query.city}` });
  }

  if (!query.town) {
    return fetchCursorPagedRows({ city: `eq.${query.city}`, district: `eq.${query.district}` });
  }

  if (!query.apartment) {
    return fetchCursorPagedRows({
      city: `eq.${query.city}`,
      district: `eq.${query.district}`,
      town: `eq.${query.town}`,
    });
  }

  return fetchCursorPagedRows({
    city: `eq.${query.city}`,
    district: `eq.${query.district}`,
    town: `eq.${query.town}`,
    apartment_name: `eq.${query.apartment}`,
  });
}

function buildOptionsFromRows(rows, query) {
  const validRows = rows.filter((row) => row.city && row.district && row.town && row.apartment_name);

  const cities = sortKo(uniq(validRows.map((row) => row.city)));
  const city = query.city && cities.includes(query.city) ? query.city : "";

  const cityRows = city ? validRows.filter((row) => row.city === city) : [];
  const districts = city ? sortKo(uniq(cityRows.map((row) => row.district))) : [];
  const district = query.district && districts.includes(query.district) ? query.district : "";

  const districtRows = district ? cityRows.filter((row) => row.district === district) : [];
  const towns = district ? sortKo(uniq(districtRows.map((row) => row.town))) : [];
  const town = query.town && towns.includes(query.town) ? query.town : "";

  const townRows = town ? districtRows.filter((row) => row.town === town) : [];
  const apartments = town ? sortKo(uniq(townRows.map((row) => row.apartment_name))) : [];
  const apartment = query.apartment && apartments.includes(query.apartment) ? query.apartment : "";

  const apartmentRows = apartment ? townRows.filter((row) => row.apartment_name === apartment) : [];
  const areas = apartment ? sortAreas(apartmentRows.map((row) => row.area_m2)) : [];
  const area = query.area && areas.includes(query.area) ? query.area : "";

  return {
    city,
    district,
    town,
    apartment,
    area,
    cities,
    districts,
    towns,
    apartments,
    areas,
    counts: {
      cities: cities.length,
      districts: districts.length,
      towns: towns.length,
      apartments: apartments.length,
      areas: areas.length,
    },
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

  try {
    if (query.propertyType !== "아파트") {
      return jsonNoStore({
        ok: true,
        source: "db-only-apartment",
        query: { city: "", district: "", town: "", apartment: "", area: "" },
        options: { cities: [], districts: [], towns: [], apartments: [], areas: [] },
        counts: { cities: 0, districts: 0, towns: 0, apartments: 0, areas: 0 },
        warning: "현재 드롭다운 제한은 아파트 실거래가 기준으로만 적용됩니다.",
      });
    }

    const paged = await fetchCacheRows(query);
    const result = buildOptionsFromRows(paged.rows, query);

    return jsonNoStore({
      ok: true,
      source: "apartment_trade_cache",
      query: {
        city: result.city,
        district: result.district,
        town: result.town,
        apartment: result.apartment,
        area: result.area,
      },
      options: {
        cities: result.cities,
        districts: result.districts,
        towns: result.towns,
        apartments: result.apartments,
        areas: result.areas,
      },
      counts: result.counts,
      debug: {
        fetched_rows: paged.rows.length,
        pages: paged.pages,
        last_id: paged.lastId,
      },
      warning:
        result.counts.cities === 0
          ? "DB에 저장된 실거래가 있는 아파트만 표시합니다. 현재 조건에 맞는 데이터가 없습니다."
          : "",
    });
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        message: error?.message || "단지 목록을 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}
