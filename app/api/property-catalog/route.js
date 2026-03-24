import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import { loadPropertyMaster, resolvePropertyOptions } from "../../lib-property-master";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
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
    if (isSupabaseConfigured()) {
      const result = await getDbRows(query);
      return NextResponse.json({
        ok: true,
        source: "supabase-db",
        query: { city: result.city, district: result.district, town: result.town, apartment: result.apartment, area: result.area },
        options: { cities: result.cities, districts: result.districts, towns: result.towns, apartments: result.apartments, areas: result.areas },
        counts: result.counts,
        note: "DB 기반 전국 단지 마스터로 검색 중입니다.",
      });
    }

    const { master, source } = await loadPropertyMaster();
    const result = resolvePropertyOptions(master, query);
    return NextResponse.json({
      ok: true,
      source,
      query: { city: result.city, district: result.district, town: result.town, apartment: result.apartment, area: result.area },
      options: { cities: result.cities, districts: result.districts, towns: result.towns, apartments: result.apartments, areas: result.areas },
      counts: result.counts,
      note: "내장 단지 마스터로 검색 중입니다. DB 연동 시 더 많은 단지명이 노출됩니다.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || "단지 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
