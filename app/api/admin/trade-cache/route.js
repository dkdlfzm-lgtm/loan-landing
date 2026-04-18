import { NextResponse } from "next/server";

const APT_TRADE_BASE =
  process.env.MOLIT_APT_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const TRADE_CACHE_MONTHS = Math.max(Number(process.env.TRADE_CACHE_MONTHS || 12), 1);
const API_RETRY_MAX = Math.max(Number(process.env.TRADE_CACHE_API_RETRY_MAX || 8), 1);
const API_MONTH_DELAY_MS = Math.max(Number(process.env.TRADE_CACHE_API_MONTH_DELAY_MS || 1500), 0);
const API_TARGET_DELAY_MS = Math.max(Number(process.env.TRADE_CACHE_API_TARGET_DELAY_MS || 2500), 0);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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
  let lastError = null;

  for (let attempt = 0; attempt < API_RETRY_MAX; attempt += 1) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      cache: "no-store",
    });

    if (response.ok) {
      const text = (await response.text()).trim();
      if (!text) {
        return { response: { header: { resultCode: "EMPTY" }, body: { items: [] } } };
      }

      if (text.startsWith("{") || text.startsWith("[")) {
        const parsed = safeParseJson(text);
        if (parsed !== null) return parsed;
        return { response: { header: { resultCode: "PARSE_ERROR", resultMsg: "JSON parse error" }, body: { raw: text, items: [] } } };
      }

      return {
        response: {
          header: { resultCode: "XML" },
          body: { items: { item: xmlItemsToObjects(text) } },
        },
      };
    }

    const retryAfter = Number(response.headers.get("retry-after") || 0);
    if (response.status === 429 || response.status >= 500) {
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(5000 * (2 ** attempt), 60000);
      lastError = new Error(`HTTP ${response.status}: ${url}`);
      await sleep(waitMs);
      continue;
    }

    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  throw lastError || new Error(`HTTP 429: ${url}`);
}

function unwrapItems(payload) {
  const body = payload?.response?.body ?? payload?.body ?? payload;
  const header = payload?.response?.header ?? payload?.header ?? {};
  const rawItems = body?.items?.item ?? body?.items ?? [];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const totalCount = Number(body?.totalCount ?? items.length ?? 0);
  return { header, items, totalCount };
}

function getRecentMonths(count = TRADE_CACHE_MONTHS) {
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
    } catch (_err) {}
  }

  throw new Error("property-master.json 파일을 찾지 못했습니다.");
}

async function supabaseRequest(path, options = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey) {
    throw new Error("Supabase 관리자 환경변수가 설정되지 않았습니다.");
  }

  const url = `${baseUrl}/rest/v1${path}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  const data = safeParseJson(text);

  if (!response.ok) {
    const message =
      data?.message || data?.hint || data?.details || `Supabase REST 오류 (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function collectTargets(master, city = "", district = "", town = "") {
  const apartmentRows = master?.["아파트"]?.[city] || [];
  return apartmentRows.filter((row) => {
    if (district && row.district !== district) return false;
    if (town && row.town !== town) return false;
    return Boolean(row.bjdCode || row.lawdCode);
  });
}

function dedupeTargets(rows) {
  const map = new Map();

  for (const row of rows) {
    const lawdCode = String(row.bjdCode || row.lawdCode || "").slice(0, 5);
    const apartmentName = normalizeText(row.apartment);
    const key = [
      row.district || "",
      row.town || "",
      apartmentName,
      normalizeJibun(row.jibun || ""),
      lawdCode,
    ].join("|");

    if (!map.has(key)) {
      map.set(key, {
        property_type: "아파트",
        city: row.city || "서울특별시",
        district: row.district || "",
        town: row.town || "",
        lawd_code: lawdCode,
        apartment_name: apartmentName,
        apartment_name_norm: normalizeApartmentName(apartmentName),
        jibun: normalizeJibun(row.jibun || ""),
      });
    }
  }

  return Array.from(map.values());
}

function getTradeApartmentName(item) {
  return normalizeText(item.aptNm || item.아파트 || item.apartmentName || "");
}

function getTradeJibun(item) {
  return normalizeJibun(item.jibun || item.지번 || item.lotNo || "");
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

function getTradeDate(item) {
  const year = String(item.dealYear || item.년 || item.year || "").padStart(4, "0");
  const month = String(item.dealMonth || item.월 || item.month || "").padStart(2, "0");
  const day = String(item.dealDay || item.일 || item.day || "01").padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTradeMatchForTarget(item, target) {
  const apartmentName = getTradeApartmentName(item);
  const apartmentNameNorm = normalizeApartmentName(apartmentName);
  const targetNameNorm = target.apartment_name_norm || normalizeApartmentName(target.apartment_name);
  const itemJibun = getTradeJibun(item);
  const targetJibun = normalizeJibun(target.jibun || "");

  const nameMatched =
    apartmentNameNorm === targetNameNorm ||
    apartmentNameNorm.includes(targetNameNorm) ||
    targetNameNorm.includes(apartmentNameNorm);

  const jibunMatched = !targetJibun || !itemJibun || itemJibun === targetJibun;
  return nameMatched && jibunMatched;
}

function buildTradeRowFromItem(target, item) {
  const amountWon = getTradeAmountWon(item);
  if (!amountWon) return null;

  const apartmentName = getTradeApartmentName(item);
  const apartmentNameNorm = normalizeApartmentName(apartmentName);
  const areaM2 = parseAreaNumber(getTradeArea(item));

  return {
    property_type: target.property_type,
    city: target.city,
    district: target.district,
    town: target.town,
    lawd_code: target.lawd_code,
    apartment_name: apartmentName,
    apartment_name_norm: apartmentNameNorm,
    jibun: getTradeJibun(item) || target.jibun || "",
    area_m2: areaM2,
    deal_date: getTradeDate(item),
    amount_won: amountWon,
    price_per_m2: Math.round(amountWon / Math.max(areaM2 || 1, 1)),
    source: "molit",
    collected_at: new Date().toISOString(),
    raw_payload: item,
  };
}

function getTradeRowKey(row) {
  return [
    row.lawd_code || "",
    row.apartment_name_norm || normalizeApartmentName(row.apartment_name || ""),
    normalizeJibun(row.jibun || ""),
    Number.isFinite(Number(row.area_m2)) ? Number(Number(row.area_m2).toFixed(2)) : "",
    row.deal_date || "",
    Number(row.amount_won || 0),
  ].join("|");
}

function dedupeTradeRows(rows) {
  const seen = new Set();
  const deduped = [];
  let duplicateCount = 0;

  for (const row of rows) {
    const key = getTradeRowKey(row);
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  return { rows: deduped, duplicateCount };
}

async function fetchLawdMonthItems(serviceKey, lawdCode, dealYmd) {
  const url = buildUrl(APT_TRADE_BASE, {
    serviceKey,
    LAWD_CD: lawdCode,
    DEAL_YMD: dealYmd,
    pageNo: 1,
    numOfRows: 999,
  });

  const payload = await fetchApi(url);
  const { header, items } = unwrapItems(payload);
  const resultCode = String(header?.resultCode ?? "00");
  if (!["00", "000", "XML", "EMPTY"].includes(resultCode)) {
    throw new Error(header?.resultMsg || `실거래가 API 오류 (${resultCode})`);
  }

  return items;
}

async function fetchTradesForTargetsByLawdCode(serviceKey, targets) {
  const months = getRecentMonths();
  const rows = [];

  for (const dealYmd of months) {
    const items = await fetchLawdMonthItems(serviceKey, targets[0].lawd_code, dealYmd);

    for (const item of items) {
      for (const target of targets) {
        if (!isTradeMatchForTarget(item, target)) continue;
        const row = buildTradeRowFromItem(target, item);
        if (row) rows.push(row);
        break;
      }
    }

    await sleep(API_MONTH_DELAY_MS);
  }

  return dedupeTradeRows(rows);
}

async function fetchExistingTradeKeys(rows) {
  if (!rows.length) return new Set();

  const lawdCode = rows[0].lawd_code;
  const dealDates = rows.map((row) => row.deal_date).filter(Boolean).sort();
  const minDate = dealDates[0];
  const maxDate = dealDates[dealDates.length - 1];

  const data = await supabaseRequest(
    `/apartment_trade_cache?select=lawd_code,apartment_name,apartment_name_norm,jibun,area_m2,deal_date,amount_won&lawd_code=eq.${encodeURIComponent(lawdCode)}&deal_date=gte.${encodeURIComponent(minDate)}&deal_date=lte.${encodeURIComponent(maxDate)}&limit=5000`
  );

  const existingRows = Array.isArray(data) ? data : [];
  return new Set(existingRows.map((row) => getTradeRowKey(row)));
}

async function insertTradeRows(rows) {
  if (!rows.length) {
    return { inserted: 0, existingDuplicateRows: 0, batchDuplicateRows: 0 };
  }

  const { rows: dedupedRows, duplicateCount } = dedupeTradeRows(rows);
  const existingKeys = await fetchExistingTradeKeys(dedupedRows);
  const insertableRows = [];
  let existingDuplicateRows = 0;

  for (const row of dedupedRows) {
    const key = getTradeRowKey(row);
    if (existingKeys.has(key)) {
      existingDuplicateRows += 1;
      continue;
    }
    insertableRows.push(row);
  }

  if (!insertableRows.length) {
    return {
      inserted: 0,
      existingDuplicateRows,
      batchDuplicateRows: duplicateCount,
    };
  }

  try {
    const data = await supabaseRequest("/apartment_trade_cache", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: insertableRows,
    });

    return {
      inserted: Array.isArray(data) ? data.length : insertableRows.length,
      existingDuplicateRows,
      batchDuplicateRows: duplicateCount,
    };
  } catch (error) {
    if (!String(error?.message || "").includes("duplicate key value violates unique constraint")) {
      throw error;
    }

    let inserted = 0;
    let extraExistingDuplicates = 0;

    for (const row of insertableRows) {
      try {
        await supabaseRequest("/apartment_trade_cache", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: row,
        });
        inserted += 1;
      } catch (rowError) {
        if (String(rowError?.message || "").includes("duplicate key value violates unique constraint")) {
          extraExistingDuplicates += 1;
          continue;
        }
        throw rowError;
      }
    }

    return {
      inserted,
      existingDuplicateRows: existingDuplicateRows + extraExistingDuplicates,
      batchDuplicateRows: duplicateCount,
    };
  }
}

export async function GET() {
  try {
    const allRows = await supabaseRequest(
      "/apartment_trade_cache?select=deal_date,collected_at&order=deal_date.desc&limit=5000"
    );

    const rows = Array.isArray(allRows) ? allRows : [];
    const totalRows = rows.length;
    const latestCollectedAt = rows[0]?.collected_at || null;

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    const todayRows = rows.filter((r) => String(r.collected_at || "").startsWith(today)).length;
    const monthlyRows = rows.filter((r) => String(r.collected_at || "").startsWith(thisMonth)).length;

    const dailyMap = new Map();
    const monthlyMap = new Map();

    rows.forEach((row) => {
      const dateKey = String(row.deal_date || "").slice(0, 10);
      const monthKey = dateKey.slice(0, 7);
      if (dateKey) dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      if (monthKey) monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
    });

    const daily = [...dailyMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const monthly = [...monthlyMap.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return NextResponse.json({
      ok: true,
      summary: {
        total_rows: totalRows,
        today_rows: todayRows,
        monthly_rows: monthlyRows,
        latest_collected_at: latestCollectedAt,
      },
      daily,
      monthly,
      job: null,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error.message || "실거래 캐시 통계를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const serviceKey = process.env.DATA_GO_KR_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        { ok: false, message: "DATA_GO_KR_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const city = normalizeText(body?.city || "서울특별시");
    const district = normalizeText(body?.district || "");
    const town = normalizeText(body?.town || "");
    const fullIngest = Boolean(body?.fullIngest);
    const offset = Math.max(Number(body?.offset || 0), 0);
    const limit = Math.max(Number(body?.limit || 1), 1);

    const { master } = await loadPropertyMasterLocal();

    let targets = [];
    if (fullIngest) {
      const rows = master?.["아파트"]?.[city] || [];
      targets = dedupeTargets(rows.map((row) => ({ ...row, city })));
    } else {
      targets = dedupeTargets(
        collectTargets(master, city, district, town).map((row) => ({ ...row, city }))
      );
    }

    if (!targets.length) {
      return NextResponse.json(
        { ok: false, message: "적재할 단지 대상을 찾지 못했습니다." },
        { status: 400 }
      );
    }

    const firstTarget = targets[offset];
    const chunkTargets = [];
    if (firstTarget) {
      for (let i = offset; i < targets.length; i += 1) {
        const target = targets[i];
        if (target.lawd_code !== firstTarget.lawd_code) break;
        chunkTargets.push(target);
      }
    }

    let savedRows = 0;
    let processedTargets = 0;
    let batchDuplicateRows = 0;
    let existingDuplicateRows = 0;
    const errors = [];

    if (chunkTargets.length) {
      try {
        const fetched = await fetchTradesForTargetsByLawdCode(serviceKey, chunkTargets);
        const result = await insertTradeRows(fetched.rows);
        savedRows += result.inserted;
        processedTargets += chunkTargets.length;
        batchDuplicateRows += fetched.duplicateCount + (result.batchDuplicateRows || 0);
        existingDuplicateRows += result.existingDuplicateRows || 0;
      } catch (err) {
        const errorMessage =
          typeof err === "string"
            ? err
            : err?.message
            ? err.message
            : err?.details
            ? err.details
            : JSON.stringify(err);

        const currentTarget = chunkTargets[0] || firstTarget;
        const errorItem = {
          apartment: currentTarget?.apartment_name || "",
          district: currentTarget?.district || "",
          town: currentTarget?.town || "",
          lawd_code: currentTarget?.lawd_code || "",
          message: errorMessage || "unknown error",
        };

        errors.push(errorItem);
        console.error("[trade-cache ingest error]", errorItem);
      }
    }

    const nextOffset = offset + chunkTargets.length;
    const done = nextOffset >= targets.length;
    const currentTarget = chunkTargets[chunkTargets.length - 1] || null;
    const currentLabel = currentTarget
      ? [currentTarget.city, currentTarget.district, currentTarget.town, `${currentTarget.apartment_name} 외 ${Math.max(chunkTargets.length - 1, 0)}개`]
          .filter(Boolean)
          .join(" ")
      : "";

    await sleep(API_TARGET_DELAY_MS);

    return NextResponse.json({
      ok: true,
      message: done ? "실거래 캐시 전체 적재가 완료되었습니다." : "다음 청크 적재가 완료되었습니다.",
      processedTargets,
      totalTargets: targets.length,
      savedRows,
      skippedRows: batchDuplicateRows + existingDuplicateRows,
      batchDuplicateRows,
      existingDuplicateRows,
      errorCount: errors.length,
      lastError: errors.length ? errors[errors.length - 1] : null,
      errors: errors.slice(0, 20),
      offset,
      nextOffset,
      limit,
      done,
      currentLabel,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "실거래 캐시 적재에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
