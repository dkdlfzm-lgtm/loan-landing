import { getApartments, getAreas, getCities, getDistricts, getTowns } from "./lib-market-options";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function buildFallbackMaster() {
  const propertyTypes = ["아파트", "오피스텔", "빌라(연립/다세대)"];
  const master = {};

  for (const propertyType of propertyTypes) {
    master[propertyType] = {};
    const cities = getCities(propertyType);
    for (const city of cities) {
      const entries = [];
      const districts = getDistricts(propertyType, city);
      for (const district of districts) {
        const towns = getTowns(propertyType, city, district);
        for (const town of towns) {
          const apartments = getApartments(propertyType, city, district, town);
          for (const apartment of apartments) {
            entries.push({
              district,
              town,
              apartment,
              areas: getAreas(propertyType, city, district, town, apartment),
            });
          }
        }
      }
      master[propertyType][city] = entries;
    }
  }

  return master;
}

let memoryCache = null;
let cacheExpiry = 0;

async function fetchRemoteMaster() {
  const url = process.env.PROPERTY_MASTER_URL;
  if (!url) return null;

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(`PROPERTY_MASTER_URL 호출 실패 (${response.status})`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("PROPERTY_MASTER_URL 응답 형식이 올바르지 않습니다.");
  }
  return payload;
}

export async function loadPropertyMaster() {
  const now = Date.now();
  if (memoryCache && cacheExpiry > now) {
    return { master: memoryCache, source: process.env.PROPERTY_MASTER_URL ? "remote-cache" : "fallback-cache" };
  }

  try {
    const remote = await fetchRemoteMaster();
    if (remote) {
      memoryCache = remote;
      cacheExpiry = now + 1000 * 60 * 30;
      return { master: remote, source: "remote" };
    }
  } catch (error) {
    console.warn("[property-master] remote load failed:", error?.message || error);
  }

  const fallback = buildFallbackMaster();
  memoryCache = fallback;
  cacheExpiry = now + 1000 * 60 * 10;
  return { master: fallback, source: "fallback" };
}

function getEntries(master, propertyType, city) {
  return master?.[propertyType]?.[city] || [];
}

export function resolvePropertyOptions(master, query = {}) {
  const propertyType = query.propertyType || "아파트";
  const cities = Object.keys(master?.[propertyType] || {});
  const city = query.city && cities.includes(query.city) ? query.city : "";
  const entries = city ? getEntries(master, propertyType, city) : [];

  const districts = city ? unique(entries.map((entry) => entry.district)) : [];
  const district = query.district && districts.includes(query.district) ? query.district : "";

  const districtEntries = district ? entries.filter((entry) => entry.district === district) : [];
  const towns = district ? unique(districtEntries.map((entry) => entry.town)) : [];
  const town = query.town && towns.includes(query.town) ? query.town : "";

  const townEntries = town ? districtEntries.filter((entry) => entry.town === town) : [];
  const apartmentQuery = String(query.apartmentQuery || "").trim().toLowerCase();
  const apartments = town
    ? unique(
        townEntries
          .filter((entry) => !apartmentQuery || entry.apartment.toLowerCase().includes(apartmentQuery))
          .map((entry) => entry.apartment)
      )
    : [];
  const apartment = query.apartment && apartments.includes(query.apartment) ? query.apartment : "";
  const areas = apartment ? unique(townEntries.find((entry) => entry.apartment === apartment)?.areas || []) : [];
  const area = query.area && areas.includes(query.area) ? query.area : "";

  return {
    propertyType,
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
