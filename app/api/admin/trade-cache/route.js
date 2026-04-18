import { NextResponse } from "next/server";

export const maxDuration = 60;

const APT_TRADE_BASE =
  process.env.MOLIT_APT_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeApartmentName(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/아파트$/g, "")
    .replace(/오피스텔$/g, "")
    .replace(/[·.,/\\-]/g, "")
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
    const pairs = [...itemXml.matchAll(/<([^/][^>]*)>([\s\S]*?)<\/>/g)];
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

function getLastCompletedMonths(count = 1) {
  const months = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);

  for (let i = 0; i < count; i += 1) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${year}${month}`);
    d.setMonth(d.getMonth() - 1);
  }

  return months;
}

async function loadPropertyMasterLocal() {
  const fs = await import("fs/promises");
  const candidates = [
    `${process.cwd()}/public/property-master.json`,
    `${process.cwd()}/property-master.json`,
  ];
  const errors = [];

  for (const filePath of candidates) {
    try {
      const json = await fs.readFile(filePath, "utf-8");
      const master = JSON.parse(json);
      return { master };
    } catch (err) {
      errors.push(`${filePath}: ${err?.message || err}`);
    }
  }

  const publicUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/property-master.json`
    : null;

  if (publicUrl) {
    try {
      const res = await fetch(publicUrl, { cache: "no-store" });
      if (res.ok) {
        return { master: await res.json() };
      }
      errors.push(`${publicUrl}: HTTP ${res.status}`);
    } catch (err) {
      errors.push(`${publicUrl}: ${err?.message || err}`);
    }
  }

  throw new Error(`property-master.json 파일을 찾지 못했습니다. ${errors.join(" | ")}`);
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

function toTradeRow(target, item) {
  const amountWon = getTradeAmountWon(item);
  if (!amountWon) return null;

  const apartmentName = getTradeApartmentName(item);
  const apartmentNameNorm = normalizeApartmentName(apartmentName);

  if (
    apartmentNameNorm !== target.apartment_name_norm &&
    !apartmentNameNorm.includes(target.apartment_name_norm) &&
    !target.apartment_name_norm.includes(apartmentNameNorm)
  ) {
    return null;
  }

  const areaValue = parseAreaNumber(getTradeArea(item));
  return {
    property_type: target.property_type,
    city: target.city,
    district: target.district,
    town: target.town,
    lawd_code: target.lawd_code,
    apartment_name: apartmentName,
    apartment_name_norm: apartmentNameNorm,
    jibun: getTradeJibun(item) || target.jibun || "",
    area_m2: areaValue,
    deal_date: getTradeDate(item),
    amount_won: amountWon,
    price_per_m2: Math.round(amountWon / Math.max(areaValue || 1, 1)),
    source: "molit",
    collected_at: new Date().toISOString(),
    raw_payload: item,
  };
}

async function fetchTradesByLawdCode(serviceKey, lawdCode, monthsToFetch) {
  const allItems = [];
  const errors = [];

  for (const dealYmd of monthsToFetch) {
    const url = buildUrl(APT_TRADE_BASE, {
      serviceKey,
      LAWD_CD: lawdCode,
      DEAL_YMD: dealYmd,
      pageNo: 1,
      numOfRows: 999,
    });

    try {
      const payload = await fetchApi(url);
      const { header, items } = unwrapItems(payload);
      const resultCode = String(header?.resultCode ?? "00");
      if (!["00", "000", "XML"].includes(resultCode)) {
        throw new Error(header?.resultMsg || `실거래가 API 오류 (${resultCode})`);
      }
      allItems.push(...items);
    } catch (err) {
      errors.push({ lawdCode, dealYmd, message: err?.message || String(err) });
    }
  }

  return { items: allItems, errors };
}

function dedupeTradeRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [
      row.lawd_code,
      row.apartment_name_norm,
      row.jibun,
      row.area_m2,
      row.deal_date,
      row.amount_won,
    ].join("|");
    if (!map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
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
    const monthsCount = Math.max(Number(body?.monthsCount || 1), 1);

    if (!district) {
      return NextResponse.json(
        { ok: false, message: "적재할 구를 선택해주세요." },
        { status: 400 }
      );
    }

    const { master } = await loadPropertyMasterLocal();
    const targets = dedupeTargets(
      collectTargets(master, city, district, town).map((row) => ({ ...row, city }))
    );

    if (!targets.length) {
      return NextResponse.json(
        { ok: false, message: "선택한 구에서 적재할 단지를 찾지 못했습니다." },
        { status: 400 }
      );
    }

    const monthsToFetch = getLastCompletedMonths(monthsCount);
    const targetsByLawd = new Map();
    for (const target of targets) {
      const list = targetsByLawd.get(target.lawd_code) || [];
      list.push(target);
      targetsByLawd.set(target.lawd_code, list);
    }

    let savedRows = 0;
    const errors = [];
    let processedGroups = 0;
    let processedTargets = 0;

    for (const [lawdCode, groupedTargets] of targetsByLawd.entries()) {
      const { items, errors: apiErrors } = await fetchTradesByLawdCode(serviceKey, lawdCode, monthsToFetch);
      errors.push(
        ...apiErrors.map((err) => ({
          district,
          town: groupedTargets[0]?.town || "",
          apartment: groupedTargets[0]?.apartment_name || "",
          lawd_code: lawdCode,
          message: `${err.message}`,
        }))
      );

      const tradeRows = [];
      for (const item of items) {
        for (const target of groupedTargets) {
          const row = toTradeRow(target, item);
          if (row) tradeRows.push(row);
        }
      }

      const dedupedRows = dedupeTradeRows(tradeRows);
      const result = await upsertTradeRows(dedupedRows);
      savedRows += result.inserted;
      processedGroups += 1;
      processedTargets += groupedTargets.length;
    }

    return NextResponse.json({
      ok: true,
      message: `${district} 적재가 완료되었습니다.`,
      mode: "district_manual",
      monthsToFetch,
      processedGroups,
      processedTargets,
      totalTargets: targets.length,
      savedRows,
      errorCount: errors.length,
      lastError: errors.length ? errors[errors.length - 1] : null,
      errors: errors.slice(0, 20),
      done: true,
      currentLabel: `${city} ${district}`,
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
