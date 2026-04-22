import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import { loadPropertyMaster, resolvePropertyOptions } from "../../lib-property-master";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeAptName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/아파트$/g, "")
    .replace(/[·.,/\\-]/g, "");
}

function normalizeAreaValue(area) {
  const match = String(area ?? "").match(/\d+(?:\.\d+)?/);
  if (!match) return "";
  const num = Number(match[0]);
  if (!Number.isFinite(num) || num <= 0) return "";
  const fixed = Number(num.toFixed(2));
  return `${fixed}㎡`;
}

function sortAreas(areas = []) {
  return unique(areas.map(normalizeAreaValue)).sort((a, b) => {
    const an = Number(String(a).replace(/㎡/g, ""));
    const bn = Number(String(b).replace(/㎡/g, ""));
    return an - bn;
  });
}

async function fetchApartmentCacheRows() {
  if (!isSupabaseConfigured()) return [];
  const rows = await supabaseRest("/apartment_trade_cache", {
    query: {
      select: "city,district,town,apartment_name,area_m2",
      property_type: "eq.아파트",
      order: "city.asc,district.asc,town.asc,apartment_name.asc",
      limit: "50000",
    },
  });
  return Array.isArray(rows) ? rows : [];
}

function resolveCacheOptions(rows, query = {}) {
  const normalizedRows = rows.map((row) => ({
    city: String(row.city || "").trim(),
    district: String(row.district || "").trim(),
    town: String(row.town || "").trim(),
    apartment: String(row.apartment_name || "").trim(),
    apartmentNorm: normalizeAptName(row.apartment_name || ""),
    area: normalizeAreaValue(row.area_m2),
  }));

  const cities = unique(normalizedRows.map((row) => row.city)).sort((a, b) => a.localeCompare(b, "ko"));
  const city = query.city && cities.includes(query.city) ? query.city : "";
  const cityRows = city ? normalizedRows.filter((row) => row.city === city) : [];

  const districts = city ? unique(cityRows.map((row) => row.district)).sort((a, b) => a.localeCompare(b, "ko")) : [];
  const district = query.district && districts.includes(query.district) ? query.district : "";
  const districtRows = district ? cityRows.filter((row) => row.district === district) : [];

  const towns = district ? unique(districtRows.map((row) => row.town)).sort((a, b) => a.localeCompare(b, "ko")) : [];
  const town = query.town && towns.includes(query.town) ? query.town : "";
  const townRows = town ? districtRows.filter((row) => row.town === town) : [];

  const apartments = town
    ? unique(townRows.map((row) => row.apartment)).sort((a, b) => a.localeCompare(b, "ko"))
    : [];
  const apartment = query.apartment && apartments.includes(query.apartment) ? query.apartment : "";

  let apartmentRows = apartment ? townRows.filter((row) => row.apartment === apartment) : [];
  if (apartment && apartmentRows.length === 0) {
    const targetNorm = normalizeAptName(apartment);
    apartmentRows = townRows.filter((row) => row.apartmentNorm === targetNorm);
  }

  const areas = apartment ? sortAreas(apartmentRows.map((row) => row.area)) : [];
  const area = query.area && areas.includes(query.area) ? query.area : "";

  return {
    propertyType: "아파트",
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
      cityCount: cities.length,
      districtCount: districts.length,
      townCount: towns.length,
      apartmentCount: apartments.length,
      areaCount: areas.length,
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
    if (query.propertyType === "아파트") {
      const cacheRows = await fetchApartmentCacheRows().catch(() => []);
      if (cacheRows.length) {
        const result = resolveCacheOptions(cacheRows, query);
        return NextResponse.json({
          ok: true,
          source: "trade-cache",
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
    return NextResponse.json({ ok: false, message: error?.message || "단지 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
