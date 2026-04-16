import { NextResponse } from "next/server";

const REB_API_BASE = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do";
const APT_TRADE_BASE =
  process.env.MOLIT_APT_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const OFFI_TRADE_BASE =
  process.env.OFFICETEL_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade";

const PROPERTY_STAT_ID_MAP = {
  아파트: process.env.REB_APT_STATBL_ID,
  오피스텔: process.env.REB_OFFICETEL_STATBL_ID,
  "빌라(연립/다세대)": process.env.REB_VILLA_STATBL_ID,
};

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeApartmentName(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/아파트$/g, "")
    .replace(/오피스텔$/g, "")
    .replace(/[·.,/\\\-]/g, "")
    .replace(/\s+/g, "");
}

function normalizeJibun(value = "") {
  return String(value || "").replace(/\s+/g, "").trim();
}

function parseAreaNumber(value) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function formatArea(value) {
  const num = parseAreaNumber(value);
  if (!Number.isFinite(num)) return String(value || "선택 면적");
  return `${Number(num.toFixed(2))}㎡`;
}

function formatEok(value) {
  const safe = Math.round(Number(value) || 0);
  if (safe <= 0) return "조회값 없음";

  const eok = Math.floor(safe / 100000000);
  const rest = safe % 100000000;
  const man = Math.round(rest / 10000);

  if (eok <= 0) return `${man.toLocaleString("ko-KR")}만원`;
  if (man <= 0) return `${eok}억`;
  return `${eok}억 ${man.toLocaleString("ko-KR")}만원`;
}

function buildUrl(base, paramsObj) {
  const queryParts = [];

  for (const [key, value] of Object.entries(paramsObj)) {
    if (value === undefined || value === null || value === "") continue;

    if (key === "serviceKey") {
      queryParts.push(`serviceKey=${String(value)}`);
    } else {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return `${base}?${queryParts.join("&")}`;
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

  const text = (await response.text()).trim();
  if (!text) {
    return { response: { header: { resultCode: "EMPTY" }, body: { items: [] } } };
  }

  if (text.startsWith("{") || text.startsWith("[")) {
    return JSON.parse(text);
  }

  return {
    response: {
      header: { resultCode: "XML" },
      body: { items: { item: xmlItemsToObjects(text) } },
    },
  };
}

function unwrapItems(payload) {
  const body = payload?.response?.body ?? payload?.body ?? payload;
  const header = payload?.response?.header ?? payload?.header ?? {};
  const rawItems = body?.items?.item ?? body?.items ?? [];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const totalCount = Number(body?.totalCount ?? items.length ?? 0);
  return { header, items, totalCount };
}

function getRecentMonths(count = 60) {
  const list = [];
  const d = new Date();
  d.setDate(1);

  for (let i = 0; i < count; i += 1) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    list.push(`${year}${month}`);
    d.setMonth(d.getMonth() - 1);
  }

  return list;
}

function getTradeApartmentName(item) {
  return normalizeText(
    item.aptNm || item.아파트 || item.offiNm || item.단지 || item.apartmentName || ""
  );
}

function getTradeTown(item) {
  return normalizeText(item.umdNm || item.법정동 || item.dong || item.town || "");
}

function getTradeArea(item) {
  return Number(item.excluUseAr || item.전용면적 || item.area || 0);
}

function getTradeAmountWon(item) {
  const raw = item.dealAmount ?? item.거래금액 ?? item.price ?? item.amount ?? "";
  const manwon = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(manwon) || manwon <= 0) return 0;
  return Math.round(manwon * 10000);
}

function getTradeDateKey(item) {
  const year = String(item.dealYear || item.년 || item.year || "").padStart(4, "0");
  const month = String(item.dealMonth || item.월 || item.month || "").padStart(2, "0");
  const day = String(item.dealDay || item.일 || item.day || "01").padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTradeJibun(item) {
  return normalizeJibun(item.jibun || item.지번 || item.lotNo || "");
}

function toleranceForArea(areaNumber) {
  if (!Number.isFinite(areaNumber)) return 2;
  if (areaNumber < 40) return 1;
  if (areaNumber < 85) return 2;
  if (areaNumber < 150) return 3.5;
  return 5;
}

async function loadPropertyMasterLocal() {
  const candidates = [
    `${process.cwd()}/public/property-master.json`,
    `${process.cwd()}/property-master.json`,
  ];

  for (const filePath of candidates) {
    try {
      const fs = await import("fs/promises");
      const json = await fs.readFile(filePath, "utf-8");
      const master = JSON.parse(json);
      return { master };
    } catch (_err) {
      // ignore
    }
  }

  throw new Error("property-master.json 파일을 찾지 못했습니다.");
}

function nameSimilarityScore(sourceName, targetName) {
  const a = normalizeApartmentName(sourceName);
  const b = normalizeApartmentName(targetName);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 90;

  let common = 0;
  for (const ch of new Set(a.split(""))) {
    if (b.includes(ch)) common += 1;
  }

  return Math.round((common / Math.max(new Set(a.split("")).size, new Set(b.split("")).size, 1)) * 100);
}

function pickCatalogEntry(master, query) {
  const rows = master?.[query.propertyType]?.[query.city] || [];
  const normalizedTarget = normalizeApartmentName(query.apartment);
  const targetArea = parseAreaNumber(query.area);

  const byTown = rows.filter(
    (row) => row.district === query.district && row.town === query.town
  );

  if (!byTown.length) return null;

  const ranked = byTown
    .map((row) => {
      const areas = Array.isArray(row.areas) ? row.areas : [];
      const bestAreaDiff = areas.length
        ? Math.min(...areas.map((area) => Math.abs(parseAreaNumber(area) - targetArea)).filter(Number.isFinite))
        : Number.POSITIVE_INFINITY;
      return {
        row,
        score: nameSimilarityScore(row.apartment, query.apartment),
        bestAreaDiff,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.bestAreaDiff - b.bestAreaDiff;
    });

  const top = ranked[0];
  if (!top || top.score < 55) return null;

  const nearArea = ranked.find(
    (x) => x.score >= 80 && Number.isFinite(targetArea) && x.bestAreaDiff <= toleranceForArea(targetArea)
  );

  return (nearArea || top).row;
}

function scoreTradeMatch(row, target) {
  let score = 0;

  if (target.targetTown && row.town && target.targetTown === row.town) score += 20;
  if (target.targetJibun && row.jibun && target.targetJibun === row.jibun) score += 120;

  const nameScore = nameSimilarityScore(row.apartmentName, target.apartment);
  if (nameScore >= 95) score += 80;
  else if (nameScore >= 85) score += 60;
  else if (nameScore >= 70) score += 35;
  else score += Math.min(nameScore, 20);

  if (Number.isFinite(target.targetArea) && Number.isFinite(row.area)) {
    const diff = Math.abs(row.area - target.targetArea);
    if (diff <= 0.3) score += 60;
    else if (diff <= 0.8) score += 50;
    else if (diff <= 1.5) score += 40;
    else if (diff <= 3) score += 24;
    else if (diff <= 5) score += 12;
    else if (diff <= 10) score += 5;
  }

  return score;
}

function buildResultSummary(query, matched, matchType, warning = undefined) {
  const latest = matched[0];
  const amounts = matched.map((row) => row.amountWon);
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const avg = Math.round(amounts.reduce((sum, value) => sum + value, 0) / amounts.length);
  const limitRatio =
    query.propertyType === "아파트" ? 0.72 : query.propertyType === "오피스텔" ? 0.68 : 0.62;

  let trendText = `최근 ${matched.length}건 실거래 기준`;
  if (matchType === "jibun+name+area") trendText = `지번·단지명·면적 일치 ${matched.length}건`;
  else if (matchType === "name+area") trendText = `단지명·면적 매칭 ${matched.length}건`;
  else if (matchType === "jibun-derived") trendText = `동일 지번 유사면적 추정 ${matched.length}건`;
  else if (matchType === "name-derived") trendText = `동일 단지 유사면적 추정 ${matched.length}건`;
  else if (matchType === "town-derived") trendText = `동일 동네 유사면적 참고 ${matched.length}건`;

  return {
    source: "molit-realtime-trade",
    count: matched.length,
    summary: {
      title: query.apartment,
      address: [query.city, query.district, query.town].filter(Boolean).join(" "),
      area: formatArea(query.area),
      tradeDate: latest.dateKey,
      latestPrice: formatEok(latest.amountWon),
      range: `${formatEok(low)} ~ ${formatEok(high)}`,
      averagePrice: formatEok(avg),
      estimateLimit: `최대 ${formatEok(Math.round(latest.amountWon * limitRatio))} 가능`,
      description: `최근 ${matched.length}건의 실거래 신고 자료를 기준으로 계산한 결과입니다. 최근 실거래가 ${formatEok(
        latest.amountWon
      )}, 평균 ${formatEok(avg)} 수준입니다.`,
      trendText,
    },
    warning,
  };
}

function buildDerivedRows(baseRows, targetArea) {
  if (!baseRows.length || !Number.isFinite(targetArea)) return [];

  return baseRows
    .filter((row) => Number.isFinite(row.area) && row.area > 0 && row.amountWon > 0)
    .map((row) => {
      const pricePerM2 = row.amountWon / row.area;
      return {
        ...row,
        amountWon: Math.round(pricePerM2 * targetArea),
      };
    })
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

async function fetchRealTradeSummary(query) {
  const serviceKey = process.env.DATA_GO_KR_KEY;
  if (!serviceKey) {
    throw new Error("DATA_GO_KR_KEY 환경변수가 설정되지 않았습니다.");
  }

  const { master } = await loadPropertyMasterLocal();
  const entry = pickCatalogEntry(master, query);

  if (!entry) {
    throw new Error("단지 정보를 property-master.json에서 찾지 못했습니다.");
  }

  const rawLawdCode = entry?.bjdCode || entry?.lawdCode;
  if (!rawLawdCode) {
    throw new Error("단지 코드 정보를 찾지 못했습니다. property-master.json을 다시 생성해 주세요.");
  }

  const lawdCode = String(rawLawdCode).slice(0, 5);
  const months = getRecentMonths(60);
  const base = query.propertyType === "오피스텔" ? OFFI_TRADE_BASE : APT_TRADE_BASE;

  const target = {
    apartment: query.apartment,
    targetName: normalizeApartmentName(query.apartment),
    targetArea: parseAreaNumber(query.area),
    targetJibun: normalizeJibun(entry?.jibun || ""),
    targetTown: normalizeText(query.town),
  };

  const responses = await Promise.all(
    months.map(async (dealYmd) => {
      const url = buildUrl(base, {
        serviceKey,
        LAWD_CD: lawdCode,
        DEAL_YMD: dealYmd,
        pageNo: 1,
        numOfRows: 999,
      });

      const payload = await fetchApi(url);
      const { header, items } = unwrapItems(payload);
      const resultCode = String(header?.resultCode ?? "00");

      if (!["00", "000", "XML"].includes(resultCode)) {
        throw new Error(header?.resultMsg || `실거래가 API 오류 (${resultCode})`);
      }

      return items;
    })
  );

  const allRows = responses
    .flat()
    .map((item) => ({
      item,
      amountWon: getTradeAmountWon(item),
      area: getTradeArea(item),
      apartmentName: getTradeApartmentName(item),
      tradeName: normalizeApartmentName(getTradeApartmentName(item)),
      town: getTradeTown(item),
      dateKey: getTradeDateKey(item),
      jibun: getTradeJibun(item),
    }))
    .filter((row) => row.amountWon > 0)
    .map((row) => ({
      ...row,
      score: scoreTradeMatch(row, target),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.dateKey.localeCompare(a.dateKey);
    });

  if (!allRows.length) {
    throw new Error("최근 실거래가 데이터를 찾지 못했습니다.");
  }

  const areaTol = toleranceForArea(target.targetArea);

  const exactRows = allRows
    .filter((row) => {
      const areaOk =
        !Number.isFinite(target.targetArea) ||
        !Number.isFinite(row.area) ||
        Math.abs(row.area - target.targetArea) <= areaTol;
      const nameOk = nameSimilarityScore(row.apartmentName, target.apartment) >= 85;
      const jibunOk = target.targetJibun && row.jibun && row.jibun === target.targetJibun;
      return jibunOk && nameOk && areaOk;
    })
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  if (exactRows.length) {
    return buildResultSummary(query, exactRows, "jibun+name+area");
  }

  const nameAreaRows = allRows
    .filter((row) => {
      const areaOk =
        !Number.isFinite(target.targetArea) ||
        !Number.isFinite(row.area) ||
        Math.abs(row.area - target.targetArea) <= areaTol;
      return nameSimilarityScore(row.apartmentName, target.apartment) >= 88 && areaOk;
    })
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  if (nameAreaRows.length) {
    return buildResultSummary(query, nameAreaRows, "name+area");
  }

  const sameJibunRows = allRows.filter(
    (row) => target.targetJibun && row.jibun && row.jibun === target.targetJibun
  );
  if (sameJibunRows.length) {
    const derived = buildDerivedRows(sameJibunRows, target.targetArea);
    if (derived.length) {
      return buildResultSummary(
        query,
        derived,
        "jibun-derived",
        "선택한 면적의 최근 실거래가가 없어 동일 지번의 유사 면적 거래를 ㎡당 가격으로 환산해 표시했습니다."
      );
    }
  }

  const sameNameRows = allRows.filter((row) => nameSimilarityScore(row.apartmentName, target.apartment) >= 88);
  if (sameNameRows.length) {
    const derived = buildDerivedRows(sameNameRows, target.targetArea);
    if (derived.length) {
      return buildResultSummary(
        query,
        derived,
        "name-derived",
        "선택한 면적의 최근 실거래가가 없어 동일 단지의 유사 면적 거래를 ㎡당 가격으로 환산해 표시했습니다."
      );
    }
  }

  const sameTownSimilarAreaRows = allRows.filter((row) => {
    const townOk = !target.targetTown || !row.town || row.town === target.targetTown;
    const areaOk =
      !Number.isFinite(target.targetArea) ||
      !Number.isFinite(row.area) ||
      Math.abs(row.area - target.targetArea) <= Math.max(areaTol * 2, 8);
    return townOk && areaOk;
  });

  if (sameTownSimilarAreaRows.length) {
    const top = sameTownSimilarAreaRows.slice(0, 15).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    const derived = buildDerivedRows(top, target.targetArea);
    if (derived.length) {
      return buildResultSummary(
        query,
        derived,
        "town-derived",
        "동일 동네의 유사 면적 최근 거래를 기준으로 참고값을 계산했습니다."
      );
    }
  }

  throw new Error("최근 실거래가 데이터를 찾지 못했습니다.");
}

function buildStatFallback(query) {
  return {
    source: "fallback",
    count: 0,
    summary: {
      title: query.apartment || `${query.town} 대표 단지`,
      address: [query.city, query.district, query.town].filter(Boolean).join(" "),
      area: formatArea(query.area),
      tradeDate: "통계 기준",
      latestPrice: "조회값 없음",
      range: "조회값 없음",
      averagePrice: "조회값 없음",
      estimateLimit: "상담 후 산정",
      description: "실거래가 데이터가 없어 통계형 참고값으로 대체 표시합니다.",
      trendText: "실거래 데이터 없음",
    },
  };
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.SttsApiTblData)) return payload.SttsApiTblData;
  if (Array.isArray(payload?.response?.body?.items)) return payload.response.body.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function pickLatestItem(items = []) {
  if (!items.length) return null;

  return [...items].sort((a, b) => {
    const av = String(a.WRTTIME_IDTFR_ID || a.wrttimeIdtfrId || a.date || "");
    const bv = String(b.WRTTIME_IDTFR_ID || b.wrttimeIdtfrId || b.date || "");
    return bv.localeCompare(av);
  })[0];
}

function makeSummaryFromStat(item, fallbackSummary, query) {
  if (!item) return fallbackSummary;

  const rawValue = Number(
    item.DT || item.dt || item.VALUE || item.value || item.PRICE || item.price || 0
  );
  if (!rawValue) return fallbackSummary;

  const numericValue = rawValue < 10000 ? rawValue * 1000000 : rawValue;
  const low = Math.round(numericValue * 0.96);
  const high = Math.round(numericValue * 1.04);
  const limitRatio =
    query.propertyType === "아파트" ? 0.72 : query.propertyType === "오피스텔" ? 0.68 : 0.62;

  return {
    ...fallbackSummary,
    tradeDate: String(item.WRTTIME_IDTFR_ID || item.wrttimeIdtfrId || fallbackSummary.tradeDate),
    latestPrice: formatEok(numericValue),
    range: `${formatEok(low)} ~ ${formatEok(high)}`,
    averagePrice: formatEok(numericValue),
    estimateLimit: `최대 ${formatEok(Math.round(numericValue * limitRatio))} 가능`,
    description: `${fallbackSummary.address} ${fallbackSummary.title} 기준의 한국부동산원 공개 통계 참고값입니다. 단지·면적별 실거래가가 아닐 수 있습니다.`,
    trendText: "통계 참고값",
  };
}

async function fetchStatSummary(query) {
  const key = process.env.REB_OPENAPI_KEY;
  const statId = PROPERTY_STAT_ID_MAP[query.propertyType];
  const fallback = buildStatFallback(query);

  if (!key || !statId) {
    return {
      ...fallback,
      warning: "실거래가 API와 통계 API 설정이 모두 없어 결과를 제공하지 못했습니다.",
    };
  }

  const url = new URL(REB_API_BASE);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("STATBL_ID", statId);
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "30");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    return { ...fallback, warning: `R-ONE API 호출 실패 (${response.status})` };
  }

  const payload = await response.json();
  const items = normalizeItems(payload);

  return {
    source: items.length ? "reb-openapi" : "fallback",
    count: items.length,
    summary: makeSummaryFromStat(pickLatestItem(items), fallback.summary, query),
    warning: "최근 실거래가를 찾지 못해 통계형 참고값으로 대체했습니다.",
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

  if (!query.city || !query.district || !query.town || !query.apartment || !query.area) {
    return NextResponse.json(
      { ok: false, message: "시도, 시군구, 읍면동, 아파트, 면적을 모두 선택해 주세요." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchRealTradeSummary(query);
    return NextResponse.json({ ok: true, ...result, query });
  } catch (error) {
    const stat = await fetchStatSummary(query).catch(() => buildStatFallback(query));
    return NextResponse.json({
      ok: true,
      ...stat,
      query,
      warning: error?.message || stat?.warning || "최근 실거래가를 찾지 못해 참고값으로 대체했습니다.",
    });
  }
}
