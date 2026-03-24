import fs from "node:fs/promises";
import path from "node:path";

const DATA_GO_KR_KEY = process.env.DATA_GO_KR_KEY || "";
const MOLIT_APT_LIST_BASE =
  process.env.MOLIT_APT_LIST_BASE ||
  "https://apis.data.go.kr/1613000/AptListService2/getSigunguAptList";
const OFFICETEL_TRADE_BASE =
  process.env.OFFICETEL_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade";
const OUT_FILE = path.resolve("public/property-master.json");

const REGION_CODES = [
  { sido: "서울시", code5List: ["11110", "11140", "11170", "11200", "11215", "11230", "11260", "11290", "11305", "11320", "11350", "11380", "11410", "11440", "11470", "11500", "11530", "11545", "11560", "11590", "11620", "11650", "11680", "11710", "11740"] },
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
  return String(value || "").replace(/\s+/g, " ").trim();
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

async function fetchXml(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.text();
}

function upsertEntry(catalog, type, city, district, town, apartment, area = null) {
  catalog[type] ??= {};
  catalog[type][city] ??= [];
  const list = catalog[type][city];

  let found = list.find(
    (item) =>
      item.district === district &&
      item.town === town &&
      item.apartment === apartment
  );

  if (!found) {
    found = { district, town, apartment, areas: [] };
    list.push(found);
  }

  if (area) {
    const normalized = normalizeText(area);
    if (normalized && !found.areas.includes(normalized)) {
      found.areas.push(normalized);
    }
  }
}

async function fetchApartmentListByLawdCode(code5) {
  const params = new URLSearchParams({
    serviceKey: DATA_GO_KR_KEY,
    LAWD_CD: code5,
    pageNo: "1",
    numOfRows: "999",
  });
  const url = `${MOLIT_APT_LIST_BASE}?${params.toString()}`;
  const xml = await fetchXml(url);
  return xmlItemsToObjects(xml);
}

async function fetchOfficetelTradesByLawdCode(code5, yyyymm) {
  const params = new URLSearchParams({
    serviceKey: DATA_GO_KR_KEY,
    LAWD_CD: code5,
    DEAL_YMD: yyyymm,
    pageNo: "1",
    numOfRows: "999",
  });
  const url = `${OFFICETEL_TRADE_BASE}?${params.toString()}`;
  const xml = await fetchXml(url);
  return xmlItemsToObjects(xml);
}

function getRecentMonths(count) {
  const now = new Date();
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

async function buildMaster() {
  const catalog = {
    "아파트": {},
    "오피스텔": {},
    "빌라(연립/다세대)": {},
  };

  for (const region of REGION_CODES) {
    for (const code5 of region.code5List) {
      try {
        const rows = await fetchApartmentListByLawdCode(code5);
        for (const row of rows) {
          const city = region.sido;
          const district = normalizeText(row.sigungu || row.sigunguNm || row.sggNm || "");
          const town = normalizeText(row.eupmyeondong || row.dong || row.dongNm || "기타");
          const apartment = normalizeText(row.kaptName || row.aptNm || row.kaptCodeNm || "");
          if (!district || !apartment) continue;
          upsertEntry(catalog, "아파트", city, district, town, apartment);
        }
        await sleep(120);
      } catch (error) {
        console.warn("[APT SKIP]", code5, String(error?.message || error));
      }
    }
  }

  const months = getRecentMonths(6);
  for (const region of REGION_CODES) {
    for (const code5 of region.code5List) {
      for (const yyyymm of months) {
        try {
          const rows = await fetchOfficetelTradesByLawdCode(code5, yyyymm);
          for (const row of rows) {
            const city = region.sido;
            const district = normalizeText(row.sggNm || row.sigungu || "기타");
            const town = normalizeText(row.umdNm || row.dong || "기타");
            const apartment = normalizeText(row.offiNm || "");
            const area = row.excluUseAr ? `${row.excluUseAr}㎡` : null;
            if (!apartment) continue;
            upsertEntry(catalog, "오피스텔", city, district, town, apartment, area);
          }
          await sleep(120);
        } catch (error) {
          console.warn("[OFFICETEL SKIP]", code5, yyyymm, String(error?.message || error));
        }
      }
    }
  }

  for (const type of Object.keys(catalog)) {
    for (const city of Object.keys(catalog[type])) {
      const deduped = new Map();
      for (const item of catalog[type][city]) {
        const key = `${item.district}||${item.town}||${item.apartment}`;
        const prev = deduped.get(key) || { ...item, areas: [] };
        for (const area of item.areas || []) {
          if (!prev.areas.includes(area)) prev.areas.push(area);
        }
        deduped.set(key, prev);
      }
      catalog[type][city] = [...deduped.values()].sort((a, b) =>
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

  const catalog = await buildMaster();
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(catalog, null, 2), "utf-8");
  console.log(`완료: ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
