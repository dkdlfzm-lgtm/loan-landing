import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import fs from "fs/promises";

const APT_TRADE_BASE =
  process.env.MOLIT_APT_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const OFFI_TRADE_BASE =
  process.env.OFFICETEL_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade";
const JOB_NAME = "full_trade_cache";
const CHUNK_SIZE = 8;

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
function formatDayKey(dateLike) {
  const d = new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatMonthKey(dateLike) {
  const d = new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function buildUrl(base, paramsObj) {
  const queryParts = [];
  for (const [key, value] of Object.entries(paramsObj)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "serviceKey") queryParts.push(`serviceKey=${String(value)}`);
    else queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return `${base}?${queryParts.join("&")}`;
}
function xmlItemsToObjects(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.map((itemXml) => {
    const pairs = [...itemXml.matchAll(/<([^/][^>]*)>([\s\S]*?)<\/\1>/g)];
    const obj = {};
    for (const [, key, value] of pairs) obj[key] = value.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    return obj;
  });
}
async function fetchApi(url) {
  const response = await fetch(url, { headers: { Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8" }, cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const text = (await response.text()).trim();
  if (!text) return { response: { header: { resultCode: "EMPTY" }, body: { items: [] } } };
  if (text.startsWith("{") || text.startsWith("[")) return JSON.parse(text);
  return { response: { header: { resultCode: "XML" }, body: { items: { item: xmlItemsToObjects(text) } } } };
}
function unwrapItems(payload) {
  const body = payload?.response?.body ?? payload?.body ?? payload;
  const rawItems = body?.items?.item ?? body?.items ?? [];
  return Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
}
function getRecentMonths(count = 24) {
  const list = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < count; i += 1) {
    list.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
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
      const json = await fs.readFile(filePath, "utf-8");
      return JSON.parse(json);
    } catch {}
  }
  throw new Error("property-master.json 파일을 찾지 못했습니다.");
}
function collectGroups(master) {
  const groups = new Map();
  for (const [propertyType, cityMap] of Object.entries(master || {})) {
    for (const [city, rows] of Object.entries(cityMap || {})) {
      for (const row of rows || []) {
        const lawdCode = String(row.bjdCode || row.lawdCode || "").slice(0, 5);
        if (!lawdCode) continue;
        const key = `${propertyType}|${lawdCode}|${city}|${row.district || ""}|${row.town || ""}`;
        if (!groups.has(key)) groups.set(key, { propertyType, lawdCode, city, district: row.district || "", town: row.town || "" });
      }
    }
  }
  return [...groups.values()].sort((a, b) => `${a.city}${a.district}${a.town}`.localeCompare(`${b.city}${b.district}${b.town}`, "ko"));
}
function getTradeApartmentName(item) { return normalizeText(item.aptNm || item.아파트 || item.offiNm || item.단지 || item.apartmentName || ""); }
function getTradeArea(item) { return Number(item.excluUseAr || item.전용면적 || item.area || 0); }
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
async function getJob() {
  const rows = await supabaseRest('/trade_cache_jobs', { query: { select: '*', name: `eq.${JOB_NAME}`, limit: '1' } });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function saveJob(job) {
  const existing = await getJob();
  if (existing?.id) {
    const rows = await supabaseRest('/trade_cache_jobs', { method: 'PATCH', query: { id: `eq.${existing.id}`, select: '*' }, body: job, prefer: 'return=representation' });
    return rows?.[0] || null;
  }
  const rows = await supabaseRest('/trade_cache_jobs', { method: 'POST', body: [{ name: JOB_NAME, ...job }], prefer: 'return=representation' });
  return rows?.[0] || null;
}
async function ingestGroup(group, serviceKey) {
  const base = group.propertyType === '오피스텔' ? OFFI_TRADE_BASE : APT_TRADE_BASE;
  const months = getRecentMonths(24);
  const rows = [];
  for (const dealYmd of months) {
    const url = buildUrl(base, { serviceKey, LAWD_CD: group.lawdCode, DEAL_YMD: dealYmd, pageNo: 1, numOfRows: 999 });
    const payload = await fetchApi(url);
    const items = unwrapItems(payload);
    for (const item of items) {
      const amountWon = getTradeAmountWon(item);
      if (!amountWon) continue;
      const area = getTradeArea(item);
      rows.push({
        property_type: group.propertyType,
        lawd_code: group.lawdCode,
        city: group.city,
        district: group.district,
        town: group.town,
        apartment_name: getTradeApartmentName(item),
        apartment_name_norm: normalizeApartmentName(getTradeApartmentName(item)),
        jibun: normalizeJibun(item.jibun || item.지번 || ''),
        area_m2: Number.isFinite(area) ? Number(area.toFixed(2)) : null,
        deal_date: getTradeDateKey(item),
        amount_won: amountWon,
        price_per_m2: Number.isFinite(area) && area > 0 ? Math.round(amountWon / area) : null,
        raw_payload: item,
        collected_at: new Date().toISOString(),
      });
    }
  }
  if (!rows.length) return 0;
  await supabaseRest('/apartment_trade_cache', {
    method: 'POST',
    query: { on_conflict: 'property_type,lawd_code,apartment_name_norm,jibun,area_m2,deal_date,amount_won' },
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  return rows.length;
}

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  try {
    const [cacheRows, job] = await Promise.all([
      supabaseRest('/apartment_trade_cache', { query: { select: 'id,collected_at', order: 'collected_at.desc', limit: '20000' } }),
      getJob(),
    ]);
    const rows = Array.isArray(cacheRows) ? cacheRows : [];
    const today = formatDayKey(new Date());
    const dailyMap = new Map();
    const monthlyMap = new Map();
    for (const row of rows) {
      const day = formatDayKey(row.collected_at);
      const month = formatMonthKey(row.collected_at);
      dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
    }
    const daily = [...dailyMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-31).map(([date,count])=>({date,count}));
    const monthly = [...monthlyMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([month,count])=>({month,count}));
    return NextResponse.json({ ok: true, summary: { total_rows: rows.length, today_rows: dailyMap.get(today) || 0, monthly_rows: monthly.length ? monthly[monthly.length - 1].count : 0, latest_collected_at: rows[0]?.collected_at || null }, daily, monthly, job: job || null, fetched_at: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '실거래 캐시 통계를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  const serviceKey = process.env.DATA_GO_KR_KEY;
  if (!serviceKey) return NextResponse.json({ ok: false, message: 'DATA_GO_KR_KEY 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action || 'start_full';
    const master = await loadPropertyMasterLocal();
    const allGroups = collectGroups(master);

    if (action === 'start_full') {
      const job = await saveJob({ scope: 'full', status: 'running', cursor: 0, total_groups: allGroups.length, processed_groups: 0, inserted_rows: 0, last_error: '', started_at: new Date().toISOString(), finished_at: null, updated_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, job, total_groups: allGroups.length });
    }
    if (action === 'run_next_chunk') {
      const job = await getJob();
      if (!job) return NextResponse.json({ ok: false, message: '진행 중인 전체 적재 작업이 없습니다.' }, { status: 400 });
      if (job.status === 'done') return NextResponse.json({ ok: true, job, done: true });
      const start = Number(job.cursor || 0);
      const chunk = allGroups.slice(start, start + CHUNK_SIZE);
      let insertedRows = Number(job.inserted_rows || 0);
      let processedGroups = Number(job.processed_groups || 0);
      let lastError = '';
      for (const group of chunk) {
        try { insertedRows += await ingestGroup(group, serviceKey); }
        catch (error) { lastError = `${group.city} ${group.district} ${group.town}: ${error.message || error}`; }
        processedGroups += 1;
      }
      const cursor = start + chunk.length;
      const done = cursor >= allGroups.length || chunk.length === 0;
      const nextJob = await saveJob({ status: done ? 'done' : 'running', cursor, total_groups: allGroups.length, processed_groups: processedGroups, inserted_rows: insertedRows, last_error: lastError, updated_at: new Date().toISOString(), finished_at: done ? new Date().toISOString() : null });
      return NextResponse.json({ ok: true, job: nextJob, done, processed_in_chunk: chunk.length });
    }
    if (action === 'reset_job') {
      const job = await saveJob({ scope: 'full', status: 'idle', cursor: 0, total_groups: allGroups.length, processed_groups: 0, inserted_rows: 0, last_error: '', updated_at: new Date().toISOString(), started_at: null, finished_at: null });
      return NextResponse.json({ ok: true, job });
    }
    return NextResponse.json({ ok: false, message: '지원하지 않는 작업입니다.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '실거래 캐시 적재에 실패했습니다.' }, { status: 500 });
  }
}
