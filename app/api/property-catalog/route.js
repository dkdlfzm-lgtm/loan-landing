import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import { loadPropertyMaster, resolvePropertyOptions } from "../../lib-property-master";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ko"));
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
    return {
      city: "",
      district: "",
      town: "",
      apartment: "",
      area: "",
      cities,
      districts: [],
      towns: [],
      apartments: [],
      areas: [],
      counts: { cityCount: cities.length, districtCount: 0, townCount: 0, apartmentCount: 0, areaCount: 0 },
    };
  }

  const cityEntries = await supabaseRest("/property_master", {
    query: {
      select: "district,town,apartment,area",
      ...baseFilter,
      city: `eq.${city}`,
      order: "district.asc,town.asc,apartment.asc,area.asc",
      limit: 50000,
    },
  });

  const districts = unique(cityEntries.map((row) => row.district));
  const district = query.district && districts.includes(query.district) ? query.district : districts[0] || "";

  const districtEntries = district ? cityEntries.filter((row) => row.district === district) : [];
  const towns = unique(districtEntries.map((row) => row.town));
  const town = query.town && towns.includes(query.town) ? query.town : towns[0] || "";

  const townEntries = town ? districtEntries.filter((row) => row.town === town) : [];
  const apartments = unique(townEntries.map((row) => row.apartment));
  const apartment = query.apartment && apartments.includes(query.apartment) ? query.apartment : apartments[0] || "";

  const apartmentEntries = apartment ? townEntries.filter((row) => row.apartment === apartment) : [];
  const areas = unique(apartmentEntries.map((row) => row.area));
  const area = query.area && areas.includes(query.area) ? query.area : areas[0] || "";

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

function pick(value, options, fallback = "") {
  if (value && options.includes(value)) return value;
  return fallback && options.includes(fallback) ? fallback : options[0] || "";
}

function mergeResult(query, fallbackResult, dbResult, useDb) {
  const cities = unique([...(fallbackResult?.cities || []), ...(dbResult?.cities || [])]);
  const city = pick(query.city, cities, useDb ? dbResult?.city : fallbackResult?.city);

  const fallbackDistricts = city === fallbackResult?.city ? fallbackResult?.districts || [] : [];
  const dbDistricts = city === dbResult?.city ? dbResult?.districts || [] : [];
  const districts = unique([...fallbackDistricts, ...dbDistricts]);
  const district = pick(query.district, districts, useDb ? dbResult?.district : fallbackResult?.district);

  const fallbackTowns = city === fallbackResult?.city && district === fallbackResult?.district ? fallbackResult?.towns || [] : [];
  const dbTowns = city === dbResult?.city && district === dbResult?.district ? dbResult?.towns || [] : [];
  const towns = unique([...fallbackTowns, ...dbTowns]);
  const town = pick(query.town, towns, useDb ? dbResult?.town : fallbackResult?.town);

  const fallbackApartments = city === fallbackResult?.city && district === fallbackResult?.district && town === fallbackResult?.town ? fallbackResult?.apartments || [] : [];
  const dbApartments = city === dbResult?.city && district === dbResult?.district && town === dbResult?.town ? dbResult?.apartments || [] : [];
  const apartments = unique([...fallbackApartments, ...dbApartments]);
  const apartment = pick(query.apartment, apartments, useDb ? dbResult?.apartment : fallbackResult?.apartment);

  const fallbackAreas = city === fallbackResult?.city && district === fallbackResult?.district && town === fallbackResult?.town && apartment === fallbackResult?.apartment ? fallbackResult?.areas || [] : [];
  const dbAreas = city === dbResult?.city && district === dbResult?.district && town === dbResult?.town && apartment === dbResult?.apartment ? dbResult?.areas || [] : [];
  const areas = unique([...fallbackAreas, ...dbAreas]);
  const area = pick(query.area, areas, useDb ? dbResult?.area : fallbackResult?.area);

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
  const query = {
    propertyType: searchParams.get("propertyType") || "아파트",
    city: searchParams.get("city") || "",
    district: searchParams.get("district") || "",
    town: searchParams.get("town") || "",
    apartment: searchParams.get("apartment") || "",
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
      const merged = mergeResult(query, fallbackResult, dbResult, shouldUseDb);

      return NextResponse.json({
        ok: true,
        source: shouldUseDb ? "supabase-db" : `${fallbackSource}-with-db-cities`,
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
    }

    return NextResponse.json({
      ok: true,
      source: fallbackSource,
      query: {
        city: fallbackResult.city,
        district: fallbackResult.district,
        town: fallbackResult.town,
        apartment: fallbackResult.apartment,
        area: fallbackResult.area,
      },
      options: {
        cities: fallbackResult.cities,
        districts: fallbackResult.districts,
        towns: fallbackResult.towns,
        apartments: fallbackResult.apartments,
        areas: fallbackResult.areas,
      },
      counts: fallbackResult.counts,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || "단지 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
