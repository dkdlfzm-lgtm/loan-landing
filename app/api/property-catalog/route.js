import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import { loadPropertyMaster, resolvePropertyOptions } from "../../lib-property-master";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function applyQuery(rows, queryText) {
  const q = String(queryText || "").trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => String(row.apartment || "").toLowerCase().includes(q));
}

async function getDbRows(query) {
  const propertyType = query.propertyType || "아파트";
  const baseFilter = { property_type: `eq.${propertyType}` };

  const cityRows = await supabaseRest("/property_master", {
    query: { select: "city", ...baseFilter, order: "city.asc", limit: 50000 },
  });
  const cities = unique(cityRows.map((row) => row.city));
  const city = query.city && cities.includes(query.city) ? query.city : cities[0] || "";
  if (!city) {
    return { city: "", district: "", town: "", apartment: "", area: "", cities, districts: [], towns: [], apartments: [], areas: [], counts: { cityCount: cities.length, districtCount: 0, townCount: 0, apartmentCount: 0, areaCount: 0 } };
  }

  const districtRows = await supabaseRest("/property_master", {
    query: { select: "district", ...baseFilter, city: `eq.${city}`, order: "district.asc", limit: 50000 },
  });
  const districts = unique(districtRows.map((row) => row.district));
  const district = query.district && districts.includes(query.district) ? query.district : districts[0] || "";

  const townRows = district
    ? await supabaseRest("/property_master", {
        query: { select: "town", ...baseFilter, city: `eq.${city}`, district: `eq.${district}`, order: "town.asc", limit: 50000 },
      })
    : [];
  const towns = unique(townRows.map((row) => row.town));
  const town = query.town && towns.includes(query.town) ? query.town : towns[0] || "";

  const apartmentRowsRaw = town
    ? await supabaseRest("/property_master", {
        query: { select: "apartment,apartment_search,sort_order", ...baseFilter, city: `eq.${city}`, district: `eq.${district}`, town: `eq.${town}`, order: "sort_order.asc,apartment.asc", limit: 20000 },
      })
    : [];
  const apartmentRows = applyQuery(apartmentRowsRaw, query.apartmentQuery);
  const apartments = unique(apartmentRows.map((row) => row.apartment));
  const apartment = query.apartment && apartments.includes(query.apartment) ? query.apartment : apartments[0] || "";

  const areaRows = apartment
    ? await supabaseRest("/property_master", {
        query: { select: "area", ...baseFilter, city: `eq.${city}`, district: `eq.${district}`, town: `eq.${town}`, apartment: `eq.${apartment}`, order: "area.asc", limit: 500 },
      })
    : [];
  const areas = unique(areaRows.map((row) => row.area));
  const area = query.area && areas.includes(query.area) ? query.area : areas[0] || "";

  return { city, district, town, apartment, area, cities, districts, towns, apartments, areas, counts: { cityCount: cities.length, districtCount: districts.length, townCount: towns.length, apartmentCount: apartments.length, areaCount: areas.length } };
}

function mergeCounts(primary, secondary) {
  return {
    cityCount: Math.max(primary?.cityCount || 0, secondary?.cityCount || 0),
    districtCount: Math.max(primary?.districtCount || 0, secondary?.districtCount || 0),
    townCount: Math.max(primary?.townCount || 0, secondary?.townCount || 0),
    apartmentCount: Math.max(primary?.apartmentCount || 0, secondary?.apartmentCount || 0),
    areaCount: Math.max(primary?.areaCount || 0, secondary?.areaCount || 0),
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
    const { master, source: fallbackSource } = await loadPropertyMaster();
    const fallbackResult = resolvePropertyOptions(master, query);

    if (isSupabaseConfigured()) {
      const dbResult = await getDbRows(query);
      const requestedCity = query.city || "";
      const dbHasRequestedCity = requestedCity ? dbResult.cities.includes(requestedCity) : false;
      const shouldUseDb = requestedCity ? dbHasRequestedCity : dbResult.cities.length > 0;
      const base = shouldUseDb ? dbResult : fallbackResult;

      return NextResponse.json({
        ok: true,
        source: shouldUseDb ? "supabase-db" : `${fallbackSource}-with-db-cities`,
        query: {
          city: base.city,
          district: base.district,
          town: base.town,
          apartment: base.apartment,
          area: base.area,
        },
        options: {
          cities: unique([...(fallbackResult.cities || []), ...(dbResult.cities || [])]),
          districts: base.districts || [],
          towns: base.towns || [],
          apartments: base.apartments || [],
          areas: base.areas || [],
        },
        counts: mergeCounts(base.counts, fallbackResult.counts),
        note: shouldUseDb
          ? "전국 기본 지역 목록과 DB 단지 데이터를 함께 사용하고 있습니다."
          : "기본 전국 지역 목록을 우선 표시하고 있습니다. 선택한 지역에 DB 단지가 있으면 자동으로 이어집니다.",
      });
    }

    return NextResponse.json({
      ok: true,
      source: fallbackSource,
      query: { city: fallbackResult.city, district: fallbackResult.district, town: fallbackResult.town, apartment: fallbackResult.apartment, area: fallbackResult.area },
      options: { cities: fallbackResult.cities, districts: fallbackResult.districts, towns: fallbackResult.towns, apartments: fallbackResult.apartments, areas: fallbackResult.areas },
      counts: fallbackResult.counts,
      note: "기본 전국 지역 목록으로 검색 중입니다.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || "단지 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
