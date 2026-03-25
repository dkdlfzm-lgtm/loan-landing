import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import { loadPropertyMaster } from "../../lib-property-master";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function pick(value, options, fallback = "") {
  if (value && options.includes(value)) return value;
  if (fallback && options.includes(fallback)) return fallback;
  return options[0] || "";
}

function normalizeQuery(searchParams) {
  return {
    propertyType: searchParams.get("propertyType") || "아파트",
    city: searchParams.get("city") || "",
    district: searchParams.get("district") || "",
    town: searchParams.get("town") || "",
    apartment: searchParams.get("apartment") || "",
    area: searchParams.get("area") || "",
  };
}

function getFallbackEntries(master, propertyType, city) {
  return master?.[propertyType]?.[city] || [];
}

async function getDbCityList(propertyType) {
  const rows = await supabaseRest("/property_master", {
    query: { select: "city", property_type: `eq.${propertyType}`, order: "city.asc", limit: 50000 },
  });
  return unique(rows.map((row) => row.city));
}

async function getDbCityEntries(propertyType, city) {
  if (!city) return [];
  return await supabaseRest("/property_master", {
    query: {
      select: "district,town,apartment,area",
      property_type: `eq.${propertyType}`,
      city: `eq.${city}`,
      order: "district.asc,town.asc,apartment.asc,area.asc",
      limit: 50000,
    },
  });
}

function buildMergedResult(query, fallbackEntries, dbEntries, fallbackCities, dbCities) {
  const cities = unique([...(fallbackCities || []), ...(dbCities || [])]);
  const city = pick(query.city, cities, query.city);

  const allEntries = [
    ...fallbackEntries.map((entry) => ({
      district: entry.district,
      town: entry.town,
      apartment: entry.apartment,
      area: null,
      areas: Array.isArray(entry.areas) ? entry.areas : [],
    })),
    ...dbEntries.map((row) => ({
      district: row.district,
      town: row.town,
      apartment: row.apartment,
      area: row.area,
      areas: [],
    })),
  ];

  const districts = unique(allEntries.map((entry) => entry.district));
  const district = pick(query.district, districts, query.district);

  const districtEntries = district ? allEntries.filter((entry) => entry.district === district) : [];
  const towns = unique(districtEntries.map((entry) => entry.town));
  const town = pick(query.town, towns, query.town);

  const townEntries = town ? districtEntries.filter((entry) => entry.town === town) : [];
  const apartments = unique(townEntries.map((entry) => entry.apartment));
  const apartment = pick(query.apartment, apartments, query.apartment);

  const apartmentEntries = apartment ? townEntries.filter((entry) => entry.apartment === apartment) : [];
  const areas = unique(
    apartmentEntries.flatMap((entry) => {
      const inline = Array.isArray(entry.areas) ? entry.areas : [];
      const single = entry.area ? [entry.area] : [];
      return [...inline, ...single];
    })
  );
  const area = pick(query.area, areas, query.area);

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
  const query = normalizeQuery(searchParams);

  try {
    const { master } = await loadPropertyMaster();
    const fallbackCities = Object.keys(master?.[query.propertyType] || {});

    let dbCities = [];
    if (isSupabaseConfigured()) {
      dbCities = await getDbCityList(query.propertyType);
    }

    const cities = unique([...fallbackCities, ...dbCities]);
    const city = pick(query.city, cities, query.city || fallbackCities[0] || dbCities[0] || "");

    const fallbackEntries = getFallbackEntries(master, query.propertyType, city);
    const dbEntries = isSupabaseConfigured() ? await getDbCityEntries(query.propertyType, city) : [];

    const merged = buildMergedResult({ ...query, city }, fallbackEntries, dbEntries, fallbackCities, dbCities);

    return NextResponse.json({
      ok: true,
      query: {
        city: merged.city,
        district: merged.district,
        town: merged.town,
        apartment: merged.apartment,
        area: merged.area,
      },
      options: {
        cities: merged.cities,
        districts: merged.districts,
        towns: merged.towns,
        apartments: merged.apartments,
        areas: merged.areas,
      },
      counts: merged.counts,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || "단지 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
