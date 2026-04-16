import { NextResponse } from "next/server";

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
    } catch (_err) {
      // ignore
    }
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
      data?.message ||
      data?.hint ||
      data?.details ||
      `Supabase REST 오류 (${response.status})`;
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
  const months = getRecentMonths(24);
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
    const total = await supabaseRequest("/apartment_trade_cache?select=id", {
      method: "GET",
      headers: { Prefer: "count=exact" },
    });

    const recentRuns = await supabaseRequest(
      "/apartment_trade_cache?select=collected_at&order=collected_at.desc&limit=20"
    );

    const totalCount = Array.isArray(total) ? total.length : 0;
    const recent = Array.isArray(recentRuns) ? recentRuns : [];

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    const todayCount = recent.filter((r) =>
      String(r.collected_at || "").startsWith(today)
    ).length;

    const monthCount = recent.filter((r) =>
      String(r.collected_at || "").startsWith(thisMonth)
    ).length;

    return NextResponse.json({
      ok: true,
      stats: {
        totalCount,
        todayCount,
        monthCount,
        recentCount: recent.length,
      },
      recentRuns: recent,
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

    let savedRows = 0;
    let processedTargets = 0;
    const errors = [];

    for (const target of targets) {
      try {
        const tradeRows = await fetchTradesForTarget(serviceKey, target);
        const result = await upsertTradeRows(tradeRows);
        savedRows += result.inserted;
        processedTargets += 1;
      } catch (err) {
        errors.push({
          apartment: target.apartment_name,
          district: target.district,
          town: target.town,
          message: err.message || "unknown error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "실거래 캐시 적재가 완료되었습니다.",
      processedTargets,
      totalTargets: targets.length,
      savedRows,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error.message || "실거래 캐시 적재에 실패했습니다." },
      { status: 500 }
    );
  }
}
