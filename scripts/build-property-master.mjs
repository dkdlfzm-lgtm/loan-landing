import fs from "node:fs/promises";
import path from "node:path";

const DATA_GO_KR_KEY = process.env.DATA_GO_KR_KEY || "";
const APT_LIST_BASE =
  process.env.MOLIT_APT_TOTAL_BASE ||
  "https://apis.data.go.kr/1613000/AptListService3/getTotalAptList3";
const APT_BASIC_INFO_BASE =
  process.env.MOLIT_APT_BASIC_INFO_BASE ||
  "https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfoV4";
const OFFICETEL_TRADE_BASE =
  process.env.OFFICETEL_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade";
const OUT_FILE = path.resolve("public/property-master.json");
const APT_ROWS_PER_PAGE = Number(process.env.APT_ROWS_PER_PAGE || 1000);
const OFFICETEL_MONTHS = Number(process.env.OFFICETEL_MONTHS || 12);
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 120);
const ENRICH_APT_BASIC = String(process.env.ENRICH_APT_BASIC || "false").toLowerCase() === "true";

const REGION_CODES = [
  { sido: "서울특별시", code5List: ["11110", "11140", "11170", "11200", "11215", "11230", "11260", "11290", "11305", "11320", "11350", "11380", "11410", "11440", "11470", "11500", "11530", "11545", "11560", "11590", "11620", "11650", "11680", "11710", "11740"] },
  { sido: "부산광역시", code5List: ["26110", "26140", "26170", "26200", "26230", "26260", "26290", "26320", "26350", "26380", "26410", "26440", "26470", "26500", "26530", "26710"] },
  { sido: "대구광역시", code5List: ["27110", "27140", "27170", "27200", "27230", "27260", "27290", "27710", "27720"] },
  { sido: "인천광역시", code5List: ["28110", "28140", "28177", "28185", "28200", "28237", "28245", "28260", "28710", "28720"] },
  { sido: "광주광역시", code5List: ["29110", "29140", "29155", "29170", "29200"] },
  { sido: "대전광역시", code5List: ["30110", "30140", "30170", "30200", "30230"] },
  { sido: "울산광역시", code5List: ["31110", "31140", "31170", "31200", "31710"] },
  { sido: "세종특별자치시", code5List: ["36110"] },
  { sido: "경기도", code5List: ["41111", "41113", "41115", "41117", "41131", "41133", "41135", "41150", "41171", "41173", "41190", "41210", "41220", "41250", "41271", "41273", "41281", "41285", "41287", "41290", "41310", "41360", "41370", "41390", "41410", "41430", "41450", "41461", "41463", "41465", "41480", "41500", "41550", "41570", "41590", "41610", "41630", "41650", "41670", "41800", "41820", "41830"] },
  { sido: "강원특별자치도", code5List: ["51110", "51130", "51150", "51170", "51190", "51210", "51230", "51720", "51730", "51750", "51760", "51770", "51780", "51790", "51800", "51810", "51820", "51830"] },
  { sido: "충청북도", code5List: ["43111", "43112", "43130", "43150", "43720", "43730", "43740", "43745", "43750", "43760", "43770"] },
  { sido: "충청남도", code5List: ["44131", "44133", "44150", "44180", "44200", "44210", "44230", "44250", "44270", "44710", "44760", "44770", "44790", "44800", "44810"] },
  { sido: "전북특별자치도", code5List: ["52111", "52113", "52180", "52190", "52210", "52220", "52230", "52710", "52720", "52730", "52740", "52750", "52770", "52790"] },
  { sido: "전라남도", code5List: ["46110", "46130", "46150", "46170", "46230", "46710", "46720", "46730", "46770", "46780", "46790", "46800", "46810", "46820", "46830", "46840", "46860", "46870", "46880", "46890", "46900", "46910"] },
  { sido: "경상북도", code5List: ["47111", "47113", "47130", "47150", "47170", "47190", "47210", "47230", "47250", "47280", "47290", "47720", "47730", "47750", "47760", "47770", "47820", "47830", "47840", "47850", "47900", "47920", "47930"] },
  { sido: "경상남도", code5List: ["48121", "48123", "48125", "48127", "48129", "48170", "48220", "48240", "48250", "48270", "48310", "48820", "48840", "48850", "48860", "48870", "48880", "48890"] },
  { sido: "제주특별자치도", code5List: ["50110", "50130"] },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function uniqueSortedAreas(areas) {
  return [...new Set((areas || []).filter(Boolean))].sort((a, b) => {
    const na = parseFloat(String(a).replace("㎡", "")) || 0;
    const nb = parseFloat(String(b).replace("㎡", "")) || 0;
    return na - nb;
  });
}

function xmlItemsToObjects(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.map((itemXml) => {
    const pairs = [...itemXml.matchAll(/<([^/][^>]*)>([\s\S]*?)<\/\1>/g)];
    const obj = {};
    for (const [, key, value] of pairs) {
      obj[key] = value.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    }
    return obj;
  });
}

function unwrapItems(payload) {
  const body = payload?.response?.body ?? payload?.body ?? payload;
  const header = payload?.response?.header ?? payload?.header ?? {};
  const rawItems = body?.items?.item ?? body?.items ?? [];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const totalCount = Number(body?.totalCount ?? items.length ?? 0);
  return { header, items, totalCount };
}

async function fetchApi(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return { response: { header: { resultCode: "EMPTY", resultMsg: "EMPTY" }, body: { items: [] } } };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  return { response: { header: { resultCode: "XML", resultMsg: "XML" }, body: { items: { item: xmlItemsToObjects(trimmed) } } } };
}

function buildUrl(base, paramsObj) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(paramsObj)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return `${base}?${params.toString()}`;
}

async function fetchApartmentPage(pageNo) {
  const url = buildUrl(APT_LIST_BASE, {
    serviceKey: DATA_GO_KR_KEY,
    pageNo,
    numOfRows: APT_ROWS_PER_PAGE,
    _type: "json",
  });
  const payload = await fetchApi(url);
  const { header, items, totalCount } = unwrapItems(payload);
  const resultCode = String(header?.resultCode ?? "00");
  if (!["00", "000", "XML"].includes(resultCode)) {
    throw new Error(header?.resultMsg || `아파트 목록 API 오류 (${resultCode})`);
  }
  return { items, totalCount };
}

async function fetchOfficetelPage(lawdCode, dealYmd, pageNo = 1) {
  const url = buildUrl(OFFICETEL_TRADE_BASE, {
    serviceKey: DATA_GO_KR_KEY,
    LAWD_CD: lawdCode,
    DEAL_YMD: dealYmd,
    pageNo,
    numOfRows: 999,
    _type: "json",
  });
  const payload = await fetchApi(url);
  const { header, items, totalCount } = unwrapItems(payload);
  const resultCode = String(header?.resultCode ?? "00");
  if (!["00", "000", "XML"].includes(resultCode)) {
    throw new Error(header?.resultMsg || `오피스텔 API 오류 (${resultCode})`);
  }
  return { items, totalCount };
}

async function fetchApartmentBasicInfo(kaptCode) {
  const url = buildUrl(APT_BASIC_INFO_BASE, {
    serviceKey: DATA_GO_KR_KEY,
    kaptCode,
    _type: "json",
  });
  const payload = await fetchApi(url);
  const body = payload?.response?.body ?? payload?.body ?? {};
  const header = payload?.response?.header ?? payload?.header ?? {};
  const resultCode = String(header?.resultCode ?? "00");
  if (!["00", "000", "XML"].includes(resultCode)) {
    throw new Error(header?.resultMsg || `공동주택 기본정보 API 오류 (${resultCode})`);
  }
  return body?.item ?? body ?? null;
}

function ensureCatalog() {
  return {
    "아파트": {},
    "오피스텔": {},
    "빌라(연립/다세대)": {},
  };
}

function upsertEntry(catalog, type, city, district, town, apartment, extra = {}) {
  const normalizedCity = normalizeText(city);
  const normalizedDistrict = normalizeText(district);
  const normalizedTown = normalizeText(town) || "기타";
  const normalizedApartment = normalizeText(apartment);

  if (!normalizedCity || !normalizedDistrict || !normalizedApartment) return;

  catalog[type] ??= {};
  catalog[type][normalizedCity] ??= [];
  const list = catalog[type][normalizedCity];

  const found = list.find(
    (item) =>
      item.district === normalizedDistrict &&
      item.town === normalizedTown &&
      item.apartment === normalizedApartment
  );

  if (found) {
    if (extra.area) {
      found.areas = uniqueSortedAreas([...(found.areas || []), extra.area]);
    }
    for (const [key, value] of Object.entries(extra)) {
      if (key === "area") continue;
      if (value !== undefined && value !== null && value !== "" && found[key] == null) {
        found[key] = value;
      }
    }
    return;
  }

  const entry = {
    district: normalizedDistrict,
    town: normalizedTown,
    apartment: normalizedApartment,
    areas: extra.area ? [extra.area] : [],
  };

  for (const [key, value] of Object.entries(extra)) {
    if (key === "area") continue;
    if (value !== undefined && value !== null && value !== "") {
      entry[key] = value;
    }
  }

  list.push(entry);
}

function getRecentMonths(count) {
  const now = new Date();
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

async function buildApartmentCatalog(catalog) {
  const first = await fetchApartmentPage(1);
  const totalPages = Math.max(1, Math.ceil(first.totalCount / APT_ROWS_PER_PAGE));

  const processItems = async (items) => {
    for (const row of items) {
      upsertEntry(
        catalog,
        "아파트",
        row.as1,
        row.as2,
        row.as3,
        row.kaptName,
        {
          kaptCode: normalizeText(row.kaptCode),
          bjdCode: normalizeText(row.bjdCode),
          as4: normalizeText(row.as4),
        }
      );
    }
  };

  await processItems(first.items);
  console.log(`아파트 수집: 1/${totalPages} (${first.items.length}건)`);

  for (let page = 2; page <= totalPages; page += 1) {
    const { items } = await fetchApartmentPage(page);
    await processItems(items);
    console.log(`아파트 수집: ${page}/${totalPages} (${items.length}건)`);
    await sleep(REQUEST_DELAY_MS);
  }
}

async function enrichApartmentBasicInfo(catalog) {
  const targets = [];
  for (const city of Object.keys(catalog["아파트"] || {})) {
    for (const item of catalog["아파트"][city]) {
      if (item.kaptCode) targets.push({ city, item });
    }
  }

  for (let i = 0; i < targets.length; i += 1) {
    const { item } = targets[i];
    try {
      const detail = await fetchApartmentBasicInfo(item.kaptCode);
      if (detail && typeof detail === "object") {
        item.kaptAddr = normalizeText(detail.kaptAddr);
        item.doroJuso = normalizeText(detail.doroJuso);
        item.codeAptNm = normalizeText(detail.codeAptNm);
        item.kaptUsedate = normalizeText(detail.kaptUsedate);
        item.kaptTel = normalizeText(detail.kaptTel);
      }
    } catch (error) {
      console.warn(`[APT DETAIL SKIP] ${item.kaptCode}: ${String(error?.message || error)}`);
    }
    if ((i + 1) % 100 === 0 || i === targets.length - 1) {
      console.log(`아파트 기본정보 보강: ${i + 1}/${targets.length}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }
}

async function buildOfficetelCatalog(catalog) {
  const months = getRecentMonths(OFFICETEL_MONTHS);

  for (const region of REGION_CODES) {
    for (const code5 of region.code5List) {
      for (const yyyymm of months) {
        try {
          const { items } = await fetchOfficetelPage(code5, yyyymm, 1);
          for (const row of items) {
            const city = region.sido;
            const district = normalizeText(row.sggNm);
            const town = normalizeText(row.umdNm);
            const apartment = normalizeText(row.offiNm);
            const area = row.excluUseAr ? `${normalizeText(row.excluUseAr)}㎡` : null;
            if (!apartment || !district) continue;
            upsertEntry(catalog, "오피스텔", city, district, town, apartment, {
              area,
              lawdCode: normalizeText(row.sggCd || code5),
              buildYear: normalizeText(row.buildYear),
            });
          }
          console.log(`오피스텔 수집: ${region.sido} ${code5} ${yyyymm} (${items.length}건)`);
        } catch (error) {
          console.warn(`[OFFICETEL SKIP] ${region.sido} ${code5} ${yyyymm}: ${String(error?.message || error)}`);
        }
        await sleep(REQUEST_DELAY_MS);
      }
    }
  }
}

function finalizeCatalog(catalog) {
  for (const type of Object.keys(catalog)) {
    for (const city of Object.keys(catalog[type] || {})) {
      const map = new Map();
      for (const item of catalog[type][city]) {
        const key = [item.district, item.town, item.apartment].join("||");
        const prev = map.get(key) || { ...item, areas: [] };
        prev.areas = uniqueSortedAreas([...(prev.areas || []), ...(item.areas || [])]);
        for (const [k, v] of Object.entries(item)) {
          if (k === "areas") continue;
          if (v !== undefined && v !== null && v !== "" && prev[k] == null) {
            prev[k] = v;
          }
        }
        map.set(key, prev);
      }

      catalog[type][city] = [...map.values()].sort((a, b) =>
        a.district.localeCompare(b.district, "ko") ||
        a.town.localeCompare(b.town, "ko") ||
        a.apartment.localeCompare(b.apartment, "ko")
      );
    }
  }

  return catalog;
}

async function main() {
  if (!DATA_GO_KR_KEY) {
    throw new Error("DATA_GO_KR_KEY 환경변수가 필요합니다.");
  }

  const catalog = ensureCatalog();

  console.log("1) 전국 아파트 목록 수집 시작");
  await buildApartmentCatalog(catalog);

  if (ENRICH_APT_BASIC) {
    console.log("2) 공동주택 기본정보 보강 시작");
    await enrichApartmentBasicInfo(catalog);
  }

  console.log("3) 오피스텔 실거래 기반 목록 수집 시작");
  await buildOfficetelCatalog(catalog);

  console.log("4) 중복 제거 및 정렬");
  finalizeCatalog(catalog);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(catalog, null, 2), "utf-8");

  const aptCount = Object.values(catalog["아파트"]).reduce((sum, arr) => sum + arr.length, 0);
  const offiCount = Object.values(catalog["오피스텔"]).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`완료: ${OUT_FILE}`);
  console.log(`아파트 ${aptCount}건 / 오피스텔 ${offiCount}건 / 빌라 ${Object.keys(catalog["빌라(연립/다세대)"]).length}개 시도`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
