import { NextResponse } from "next/server";
import { loadPropertyMaster, resolvePropertyOptions } from "../../lib-property-master";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function sortKo(values = []) {
  return unique(values).sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function normalizeAreaLabel(value) {
  const m = String(value ?? "").match(/\d+(?:\.\d+)?/);
  if (!m) return "";
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Number(n.toFixed(2))}㎡`;
}

async function loadApartmentCacheOptions(query) {
  if (!isSupabaseConfigured()) return null;

  const propertyType = query.propertyType || "아파트";
  if (propertyType !== "아파트") return null;

  const citiesRows = await supabaseRest('/apartment_trade_cache', {
    query: {
      select: 'city',
      property_type: `eq.${propertyType}`,
      order: 'city.asc',
      limit: '20000',
    },
  });
  const cities = sortKo((citiesRows || []).map((row) => row.city));
  const city = query.city && cities.includes(query.city) ? query.city : '';

  let districts = [];
  let district = '';
  if (city) {
    const districtRows = await supabaseRest('/apartment_trade_cache', {
      query: {
        select: 'district',
        property_type: `eq.${propertyType}`,
        city: `eq.${city}`,
        order: 'district.asc',
        limit: '20000',
      },
    });
    districts = sortKo((districtRows || []).map((row) => row.district));
    district = query.district && districts.includes(query.district) ? query.district : '';
  }

  let towns = [];
  let town = '';
  if (city && district) {
    const townRows = await supabaseRest('/apartment_trade_cache', {
      query: {
        select: 'town',
        property_type: `eq.${propertyType}`,
        city: `eq.${city}`,
        district: `eq.${district}`,
        order: 'town.asc',
        limit: '20000',
      },
    });
    towns = sortKo((townRows || []).map((row) => row.town));
    town = query.town && towns.includes(query.town) ? query.town : '';
  }

  let apartments = [];
  let apartment = '';
  if (city && district && town) {
    const aptRows = await supabaseRest('/apartment_trade_cache', {
      query: {
        select: 'apartment_name',
        property_type: `eq.${propertyType}`,
        city: `eq.${city}`,
        district: `eq.${district}`,
        town: `eq.${town}`,
        order: 'apartment_name.asc',
        limit: '20000',
      },
    });
    const apartmentQuery = String(query.apartmentQuery || '').trim().toLowerCase();
    apartments = sortKo(
      (aptRows || [])
        .map((row) => row.apartment_name)
        .filter((name) => !apartmentQuery || String(name).toLowerCase().includes(apartmentQuery))
    );
    apartment = query.apartment && apartments.includes(query.apartment) ? query.apartment : '';
  }

  let areas = [];
  let area = '';
  if (city && district && town && apartment) {
    const areaRows = await supabaseRest('/apartment_trade_cache', {
      query: {
        select: 'area_m2',
        property_type: `eq.${propertyType}`,
        city: `eq.${city}`,
        district: `eq.${district}`,
        town: `eq.${town}`,
        apartment_name: `eq.${apartment}`,
        order: 'area_m2.asc',
        limit: '20000',
      },
    });
    areas = sortKo((areaRows || []).map((row) => normalizeAreaLabel(row.area_m2)));
    area = query.area && areas.includes(query.area) ? query.area : '';
  }

  return {
    source: 'trade-cache',
    query: { city, district, town, apartment, area },
    options: { cities, districts, towns, apartments, areas },
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
    propertyType: searchParams.get('propertyType') || '아파트',
    city: searchParams.get('city') || '',
    district: searchParams.get('district') || '',
    town: searchParams.get('town') || '',
    apartment: searchParams.get('apartment') || '',
    apartmentQuery: searchParams.get('apartmentQuery') || '',
    area: searchParams.get('area') || '',
  };

  try {
    const cacheResult = await loadApartmentCacheOptions(query);
    if (cacheResult && cacheResult.options.cities.length) {
      return NextResponse.json({
        ok: true,
        source: cacheResult.source,
        query: cacheResult.query,
        options: cacheResult.options,
        counts: cacheResult.counts,
        warning: '',
      });
    }

    const { master, source } = await loadPropertyMaster(request.url);
    const result = resolvePropertyOptions(master, query);
    const isEmptySource = source === 'missing';

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
      warning: isEmptySource ? 'public/property-master.json 파일이 아직 없습니다. 생성한 전국 목록 파일을 public 폴더에 넣어주세요.' : '',
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || '단지 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
