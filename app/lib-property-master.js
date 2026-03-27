import fs from "node:fs/promises";
import path from "node:path";

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

let memoryCache = null;
let cacheExpiry = 0;

async function loadLocalMaster() {
  const localPath = path.join(process.cwd(), "public", "property-master.json");
  const raw = await fs.readFile(localPath, "utf-8");
  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== "object") {
    throw new Error("property-master.json 형식이 올바르지 않습니다.");
  }
  return payload;
}

export async function loadPropertyMaster() {
  const now = Date.now();
  if (memoryCache && cacheExpiry > now) {
    return { master: memoryCache, source: "local-cache" };
  }

  try {
    const local = await loadLocalMaster();
    memoryCache = local;
    cacheExpiry = now + 1000 * 60 * 30;
    return { master: local, source: "local" };
  } catch (error) {
    if (error?.code === "ENOENT") {
      const empty = { "아파트": {}, "오피스텔": {}, "빌라(연립/다세대)": {} };
      memoryCache = empty;
      cacheExpiry = now + 1000 * 60 * 5;
      return { master: empty, source: "missing" };
    }
    throw error;
  }
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
  const apartments = town
    ? unique(
        townEntries
          .filter((entry) => !apartmentQuery || entry.apartment.toLowerCase().includes(apartmentQuery))
          .map((entry) => entry.apartment)
      ).sort((a, b) => a.localeCompare(b, "ko"))
    : [];
  const apartment = query.apartment && apartments.includes(query.apartment) ? query.apartment : "";
  const areas = apartment
    ? unique(
        townEntries
          .filter((entry) => entry.apartment === apartment)
          .flatMap((entry) => entry.areas || [])
      )
    : [];
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
