import { NextResponse } from "next/server";
import { loadPropertyMaster, resolvePropertyOptions } from "../../lib-property-master";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

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

async function fetchCacheRows(query) {
  const filters = {
    select: "city,district,town,apartment_name,area_m2",
    property_type: "eq.아파트",
    limit: "50000",
  };
  if (query.city) filters.city = `eq.${query.city}`;
  if (query.district) filters.district = `eq.${query.district}`;
  if (query.town) filters.town = `eq.${query.town}`;
  if (query.apartment) filters.apartment_name = `eq.${query.apartment}`;

  const rows = await supabaseRest("/apartment_trade_cache", { query: filters });
  return Array.isArray(rows) ? rows : [];
}

function buildOptionsFromCache(rows, query) {
  const cities = sortKo(uniq(rows.map((row) => row.city)));
  const city = query.city && cities.includes(query.city) ? query.city : "";

  const cityRows = city ? rows.filter((row) => row.city === city) : [];
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
    apartmentQuery: searchParams.get("apartmentQuery") || "",
    area: searchParams.get("area") || "",
  };

  try {
    if (query.propertyType === "아파트" && isSupabaseConfigured()) {
      const rows = await fetchCacheRows(query);
      if (rows.length > 0) {
        const result = buildOptionsFromCache(rows, query);
        return NextResponse.json({
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
          warning: "",
        });
      }
    }

    const { master, source } = await loadPropertyMaster(request.url);
    const result = resolvePropertyOptions(master, query);
    const isEmptySource = source === "missing";

    return NextResponse.json({
      ok: true,
      source,
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
      warning: isEmptySource ? "public/property-master.json 파일이 아직 없습니다. 생성한 전국 목록 파일을 public 폴더에 넣어주세요." : "",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error?.message || "단지 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
