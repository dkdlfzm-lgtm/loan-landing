import { NextResponse } from "next/server";

const APT_TRADE_BASE =
  process.env.MOLIT_APT_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

const REQUEST_DELAY_MS = Number(process.env.TRADE_CACHE_REQUEST_DELAY_MS || 1200);
const TARGET_DELAY_MS = Number(process.env.TRADE_CACHE_TARGET_DELAY_MS || 3500);
const MAX_RETRIES = Number(process.env.TRADE_CACHE_MAX_RETRIES || 8);
const BASE_BACKOFF_MS = Number(process.env.TRADE_CACHE_BASE_BACKOFF_MS || 2500);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(response, attempt) {
  const retryAfterHeader = response?.headers?.get?.("retry-after");
  const retryAfterSeconds = Number(retryAfterHeader);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  const jitter = Math.floor(Math.random() * 800);
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), 60000) + jitter;
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

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
        cache: "no-store",
      });
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES) break;
      await sleep(getRetryDelayMs(null, attempt));
      continue;
    }

    if (response.ok) {
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

    const retriable = response.status === 429 || response.status >= 500;
    const error = new Error(`HTTP ${response.status}: ${url}`);
    lastError = error;

    if (!retriable || attempt >= MAX_RETRIES) {
      throw error;
    }

    await sleep(getRetryDelayMs(response, attempt));
  }

  throw lastError || new Error(`API 요청 실패: ${url}`);
}

function unwrapItems(payload) {
  const body = payload?.response?.body ?? payload?.body ?? payload;
  const header = payload?.response?.header ?? payload?.header ?? {};
  const rawItems = body?.items?.item ?? body?.items ?? [];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const totalCount = Number(body?.totalCount ?? items.length ?? 0);
  return { header, items, totalCount };
}

function getRecentMonths(count = 24) {
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
  const data = text ? JSON.parse(text) : null;

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

async function fetchTradesForTarget(serviceKey, target) {
  const months = getRecentMonths(Number(process.env.TRADE_CACHE_MONTHS || 24));
  const rows = [];

  for (const dealYmd of months) {
    const url = buildUrl(APT_TRADE_BASE, {
      serviceKey,
      LAWD_CD: target.lawd_code,
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

    for (const item of items) {
      const amountWon = getTradeAmountWon(item);
      if (!amountWon) continue;

      const apartmentName = getTradeApartmentName(item);
      const apartmentNameNorm = normalizeApartmentName(apartmentName);

      if (
        apartmentNameNorm !== target.apartment_name_norm &&
        !apartmentNameNorm.includes(target.apartment_name_norm) &&
        !target.apartment_name_norm.includes(apartmentNameNorm)
      ) {
        continue;
      }

      rows.push({
        property_type: target.property_type,
        city: target.city,
        district: target.district,
        town: target.town,
        lawd_code: target.lawd_code,
        apartment_name: apartmentName,
        apartment_name_norm: apartmentNameNorm,
        jibun: getTradeJibun(item) || target.jibun || "",
        area_m2: parseAreaNumber(getTradeArea(item)),
        deal_date: getTradeDate(item),
        amount_won: amountWon,
        price_per_m2: Math.round(amountWon / Math.max(parseAreaNumber(getTradeArea(item)) || 1, 1)),
        source: "molit",
        collected_at: new Date().toISOString(),
        raw_payload: item,
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return rows;
}

async function upsertTradeRows(rows) {
  if (!rows.length) return { inserted: 0 };

  const data = await supabaseRequest("/apartment_trade_cache", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: rows,
  });

  return { inserted: Array.isArray(data) ? data.length : rows.length };
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

    const chunkTargets = targets.slice(offset, offset + limit);

    let savedRows = 0;
    let processedTargets = 0;
    const errors = [];

    for (const target of chunkTargets) {
      try {
        const tradeRows = await fetchTradesForTarget(serviceKey, target);
        const result = await upsertTradeRows(tradeRows);
        savedRows += result.inserted;
        processedTargets += 1;
      } catch (err) {
        const errorMessage =
          typeof err === "string"
            ? err
            : err?.message
            ? err.message
            : err?.details
            ? err.details
            : JSON.stringify(err);

        const errorItem = {
          apartment: target.apartment_name,
          district: target.district,
          town: target.town,
          lawd_code: target.lawd_code,
          message: errorMessage || "unknown error",
        };

        errors.push(errorItem);
        console.error("[trade-cache ingest error]", errorItem);
      }

      await sleep(TARGET_DELAY_MS);
    }

    const nextOffset = offset + chunkTargets.length;
    const done = nextOffset >= targets.length;
    const currentTarget = chunkTargets[chunkTargets.length - 1] || null;
    const currentLabel = currentTarget
      ? [currentTarget.city, currentTarget.district, currentTarget.town, currentTarget.apartment_name]
          .filter(Boolean)
          .join(" ")
      : "";

    return NextResponse.json({
      ok: true,
      message: done ? "실거래 캐시 전체 적재가 완료되었습니다." : "다음 청크 적재가 완료되었습니다.",
      processedTargets,
      totalTargets: targets.length,
      savedRows,
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
