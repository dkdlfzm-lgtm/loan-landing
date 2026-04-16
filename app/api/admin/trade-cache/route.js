import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

const APT_TRADE_BASE =
  process.env.MOLIT_APT_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const OFFI_TRADE_BASE =
  process.env.OFFICETEL_TRADE_BASE ||
  "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade";

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
function normalizeJibun(value = "") { return String(value || "").replace(/\s+/g, "").trim(); }
function getTradeApartmentName(item) { return normalizeText(item.aptNm || item.아파트 || item.offiNm || item.단지 || item.apartmentName || ""); }
function getTradeJibun(item) { return normalizeJibun(item.jibun || item.지번 || item.lotNo || ""); }
function getTradeArea(item) { return Number(item.excluUseAr || item.전용면적 || item.area || 0); }
function getTradeAmountWon(item) { const raw = item.dealAmount ?? item.거래금액 ?? item.price ?? item.amount ?? ""; const manwon = Number(String(raw).replace(/[^0-9.]/g, "")); return Number.isFinite(manwon) && manwon > 0 ? Math.round(manwon * 10000) : 0; }
function getTradeDateKey(item) { const y = String(item.dealYear || item.년 || item.year || "").padStart(4, "0"); const m = String(item.dealMonth || item.월 || item.month || "").padStart(2, "0"); const d = String(item.dealDay || item.일 || item.day || "01").padStart(2, "0"); return `${y}-${m}-${d}`; }

async function loadPropertyMasterLocal() {
  const candidates = [`${process.cwd()}/public/property-master.json`, `${process.cwd()}/property-master.json`];
  for (const filePath of candidates) {
    try {
      const fs = await import("fs/promises");
      const json = await fs.readFile(filePath, "utf-8");
      return { master: JSON.parse(json) };
    } catch (_e) {}
  }
  throw new Error("property-master.json 파일을 찾지 못했습니다.");
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
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8" }, cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const text = (await response.text()).trim();
  if (!text) return { response: { header: { resultCode: "EMPTY" }, body: { items: [] } } };
  if (text.startsWith("{") || text.startsWith("[")) return JSON.parse(text);
  return { response: { header: { resultCode: "XML" }, body: { items: { item: xmlItemsToObjects(text) } } } };
}
function unwrapItems(payload) {
  const body = payload?.response?.body ?? payload?.body ?? payload;
  const header = payload?.response?.header ?? payload?.header ?? {};
  const rawItems = body?.items?.item ?? body?.items ?? [];
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return { header, items };
}
function getRecentMonths(count = 24) {
  const list = []; const d = new Date(); d.setDate(1);
  for (let i = 0; i < count; i += 1) { list.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() - 1); }
  return list;
}
function pickRows(master, filters) {
  const rows = master?.[filters.propertyType]?.[filters.city] || [];
  return rows.filter((row) => (!filters.district || row.district === filters.district) && (!filters.town || row.town === filters.town));
}
function uniqBy(items, getKey) { const map = new Map(); items.forEach((item)=>{ const key=getKey(item); if(!map.has(key)) map.set(key,item);}); return [...map.values()]; }

async function getStats() {
  const [cacheRows, runRows] = await Promise.all([
    supabaseRest("/apartment_trade_cache", { query: { select: "id,property_type,lawd_code,city,district,town,trade_date,collected_at", order: "trade_date.desc", limit: "20000" } }),
    supabaseRest("/trade_cache_runs", { query: { select: "id,property_type,city,district,town,status,row_count,started_at,finished_at,message", order: "started_at.desc", limit: "20" } }).catch(() => []),
  ]);
  const rows = Array.isArray(cacheRows) ? cacheRows : [];
  const runs = Array.isArray(runRows) ? runRows : [];
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const liveCutoff = Date.now() - 5 * 60 * 1000;
  const dailyMap = new Map(); const monthlyMap = new Map();
  for (const row of rows) { const day = String(row.trade_date || "").slice(0,10); const monthKey = day.slice(0,7); if(day) dailyMap.set(day,(dailyMap.get(day)||0)+1); if(monthKey) monthlyMap.set(monthKey,(monthlyMap.get(monthKey)||0)+1); }
  return {
    summary: {
      total_rows: rows.length,
      today_rows: rows.filter((row) => String(row.collected_at || "").slice(0,10) === today).length,
      month_rows: rows.filter((row) => String(row.collected_at || "").slice(0,7) === month).length,
      live_runs_5m: runs.filter((run) => new Date(run.started_at).getTime() >= liveCutoff).length,
      districts: new Set(rows.map((row) => `${row.city}|${row.district}`)).size,
      latest_trade_date: rows[0]?.trade_date || null,
      latest_collected_at: rows[0]?.collected_at || null,
    },
    daily: [...dailyMap.entries()].map(([date, count]) => ({ date, count })).sort((a,b)=>a.date.localeCompare(b.date)).slice(-31),
    monthly: [...monthlyMap.entries()].map(([month, count]) => ({ month, count })).sort((a,b)=>a.month.localeCompare(b.month)).slice(-12),
    runs,
  };
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try { return NextResponse.json({ ok: true, ...(await getStats()), fetched_at: new Date().toISOString() }); }
  catch (error) { return NextResponse.json({ ok: false, message: error.message || "실거래가 캐시 통계를 불러오지 못했습니다." }, { status: 500 }); }
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  const serviceKey = process.env.DATA_GO_KR_KEY;
  if (!serviceKey) return NextResponse.json({ ok: false, message: "DATA_GO_KR_KEY 환경변수가 설정되지 않았습니다." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const filters = { propertyType: String(body.propertyType || "아파트"), city: String(body.city || "").trim(), district: String(body.district || "").trim(), town: String(body.town || "").trim() };
  if (!filters.city) return NextResponse.json({ ok: false, message: "도/시를 입력해주세요." }, { status: 400 });
  let run = null;
  try {
    run = await supabaseRest("/trade_cache_runs", { method: "POST", prefer: "return=representation", body: [{ property_type: filters.propertyType, city: filters.city, district: filters.district || null, town: filters.town || null, status: "running", started_at: new Date().toISOString() }] });
    run = Array.isArray(run) ? run[0] : run;
  } catch (_e) {}
  try {
    const { master } = await loadPropertyMasterLocal();
    const rows = pickRows(master, filters);
    if (!rows.length) throw new Error("선택한 조건의 단지 정보를 찾지 못했습니다.");
    const uniqueCodes = uniqBy(rows.map((row) => ({ lawdCode: String(row.bjdCode || row.lawdCode || "").slice(0, 5), city: filters.city, district: row.district, town: row.town })).filter((row) => row.lawdCode), (row) => `${row.lawdCode}|${row.city}|${row.district}|${row.town}`);
    const months = getRecentMonths(24); const base = filters.propertyType === "오피스텔" ? OFFI_TRADE_BASE : APT_TRADE_BASE; const cacheRows = [];
    for (const codeRow of uniqueCodes) {
      for (const dealYmd of months) {
        const url = buildUrl(base, { serviceKey, LAWD_CD: codeRow.lawdCode, DEAL_YMD: dealYmd, pageNo: 1, numOfRows: 999 });
        const payload = await fetchApi(url); const { header, items } = unwrapItems(payload); const resultCode = String(header?.resultCode ?? "00"); if (!["00","000","XML"].includes(resultCode)) continue;
        for (const item of items) {
          const apartmentName = getTradeApartmentName(item); const area = getTradeArea(item); const amountWon = getTradeAmountWon(item); if (!apartmentName || !amountWon) continue;
          const dealDate = getTradeDateKey(item); const jibun = getTradeJibun(item);
          cacheRows.push({ property_type: filters.propertyType, city: codeRow.city, district: codeRow.district, town: codeRow.town, lawd_code: codeRow.lawdCode, apartment_name: apartmentName, apartment_name_norm: normalizeApartmentName(apartmentName), jibun: jibun || null, area_m2: Number.isFinite(area) ? Number(area.toFixed(2)) : null, deal_date: dealDate, amount_won: amountWon, price_per_m2: Number.isFinite(area) && area > 0 ? Math.round(amountWon / area) : null, source: "molit-realtime-trade", collected_at: new Date().toISOString() });
        }
      }
    }
    const deduped = uniqBy(cacheRows, (row) => [row.property_type,row.lawd_code,row.apartment_name_norm,row.jibun||"",row.area_m2||"",row.deal_date,row.amount_won].join("|"));
    if (deduped.length) await supabaseRest("/apartment_trade_cache", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: deduped });
    if (run?.id) await supabaseRest(`/trade_cache_runs?id=eq.${run.id}`, { method: "PATCH", body: { status: "success", row_count: deduped.length, finished_at: new Date().toISOString(), message: null } }).catch(()=>null);
    return NextResponse.json({ ok: true, row_count: deduped.length, ...(await getStats()), message: `${deduped.length}건의 실거래 캐시를 저장했습니다.` });
  } catch (error) {
    if (run?.id) await supabaseRest(`/trade_cache_runs?id=eq.${run.id}`, { method: "PATCH", body: { status: "failed", finished_at: new Date().toISOString(), message: error.message || "실패" } }).catch(()=>null);
    return NextResponse.json({ ok: false, message: error.message || "실거래가 캐시 적재에 실패했습니다." }, { status: 500 });
  }
}
