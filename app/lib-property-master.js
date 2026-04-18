import bundledPropertyMaster from "../property-master.json";

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
    .replace(/[·.,/\-]/g, "");
}

function normalizeAreaValue(area) {
  const match = String(area ?? "").match(/\d+(?:\.\d+)?/);
  if (!match) return "";
  const num = Number(match[0]);
  if (!Number.isFinite(num) || num <= 0) return "";
  const fixed = Number(num.toFixed(2));
  return `${Number.isInteger(fixed) ? fixed : fixed}㎡`;
}

function sortAreas(areas = []) {
  return unique(areas.map(normalizeAreaValue)).sort((a, b) => {
    const an = Number(String(a).replace(/㎡/g, ""));
    const bn = Number(String(b).replace(/㎡/g, ""));
    return an - bn;
  });
}

function normalizePayload(payload) {
  const result = { "아파트": {}, "오피스텔": {}, "빌라(연립/다세대)": {} };

  if (Array.isArray(payload)) {
    const bucket = result["아파트"];
    for (const row of payload) {
      const city = row.city || row.sido || "";
      if (!city) continue;
      if (!bucket[city]) bucket[city] = [];
      bucket[city].push({
        ...row,
        district: row.district || row.sigungu || "",
        town: row.town || row.dong || "",
        apartment: row.apartment || row.name || "",
        areas: sortAreas(row.areas || []),
      });
    }
    return result;
  }

  for (const type of Object.keys(result)) {
    const cities = payload?.[type] || {};
    for (const [city, rows] of Object.entries(cities)) {
      result[type][city] = Array.isArray(rows)
        ? rows.map((row) => ({
            ...row,
            district: row.district || row.sigungu || "",
            town: row.town || row.dong || "",
            apartment: row.apartment || row.name || "",
            areas: sortAreas(row.areas || []),
          }))
        : [];
    }
  }

  return result;
}

let memoryCache = null;
let cacheExpiry = 0;

export async function loadPropertyMaster(requestUrl = "") {
  const now = Date.now();
  if (memoryCache && cacheExpiry > now) {
    return { master: memoryCache, source: "bundled-cache" };
  }

  const normalized = normalizePayload(bundledPropertyMaster);
  memoryCache = normalized;
  cacheExpiry = now + 1000 * 60 * 30;
  return { master: normalized, source: "bundled-import" };
}

function getEntries(master, propertyType, city) {
  return master?.[propertyType]?.[city] || [];
}

export function resolvePropertyOptions(master, query = {}) {
  const propertyType = query.propertyType || "아파트";
  const cities = Object.keys(master?.[propertyType] || {}).sort((a, b) => a.localeCompare(b, "ko"));
  const city = query.city && cities.includes(query.city) ? query.city : "";
  const entries = city ? getEntries(master, propertyType, city) : [];

  const districts = city ? unique(entries.map((entry) => entry.district)).sort((a, b) => a.localeCompare(b, "ko")) : [];
  const district = query.district && districts.includes(query.district) ? query.district : "";

  const districtEntries = district ? entries.filter((entry) => entry.district === district) : [];
  const towns = district ? unique(districtEntries.map((entry) => entry.town)).sort((a, b) => a.localeCompare(b, "ko")) : [];
  const town = query.town && towns.includes(query.town) ? query.town : "";

  const townEntries = town ? districtEntries.filter((entry) => entry.town === town) : [];
  const apartmentQuery = String(query.apartmentQuery || "").trim().toLowerCase();

  const entriesWithAreas = townEntries.filter((entry) => Array.isArray(entry.areas) && entry.areas.length > 0);
  const apartmentSourceEntries = entriesWithAreas.length > 0 ? entriesWithAreas : townEntries;

  const apartments = town
    ? unique(
        apartmentSourceEntries
          .filter((entry) => !apartmentQuery || entry.apartment.toLowerCase().includes(apartmentQuery))
          .map((entry) => entry.apartment)
      ).sort((a, b) => a.localeCompare(b, "ko"))
    : [];

  const apartment = query.apartment && apartments.includes(query.apartment) ? query.apartment : "";

  let areaEntries = apartment ? townEntries.filter((entry) => entry.apartment === apartment) : [];
  let areas = apartment ? sortAreas(areaEntries.flatMap((entry) => entry.areas || [])) : [];

  if (apartment && areas.length === 0) {
    const normalized = normalizeAptName(apartment);
    const similarEntries = townEntries.filter((entry) => normalizeAptName(entry.apartment) === normalized);
    areas = sortAreas(similarEntries.flatMap((entry) => entry.areas || []));
  }

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