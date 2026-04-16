import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

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

function normalizeText(value = "") { return String(value).replace(/\s+/g, " ").trim(); }
function normalizeApartmentName(value = "") {
  return normalizeText(value).toLowerCase().replace(/\(.*?\)/g, "").replace(/아파트$/g, "").replace(/오피스텔$/g, "").replace(/[·.,/\\\-]/g, "").replace(/\s+/g, "");
}
function normalizeJibun(value = "") { return String(value || "").replace(/\s+/g, "").trim(); }
function parseAreaNumber(value) { const m = String(value ?? "").match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; }
function formatArea(value) { const n = parseAreaNumber(value); return Number.isFinite(n) ? `${Number(n.toFixed(2))}㎡` : String(value || "선택 면적"); }
function formatEok(value) { const safe = Math.round(Number(value) || 0); if (safe <= 0) return "조회값 없음"; const eok = Math.floor(safe / 100000000); const rest = safe % 100000000; const man = Math.round(rest / 10000); if (eok <= 0) return `${man.toLocaleString("ko-KR")}만원`; if (man <= 0) return `${eok}억`; return `${eok}억 ${man.toLocaleString("ko-KR")}만원`; }
function buildUrl(base, paramsObj) { const q=[]; for (const [k,v] of Object.entries(paramsObj)) { if (v===undefined||v===null||v==="") continue; q.push(k === "serviceKey" ? `serviceKey=${String(v)}` : `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`); } return `${base}?${q.join("&")}`; }
function xmlItemsToObjects(xml) { const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m)=>m[1]); return items.map((itemXml)=>{ const pairs=[...itemXml.matchAll(/<([^/][^>]*)>([\s\S]*?)<\/\1>/g)]; const obj={}; for (const [,k,v] of pairs) obj[k]=v.replace(/<!\[CDATA\[|\]\]>/g,"").trim(); return obj;}); }
async function fetchApi(url) { const res=await fetch(url,{method:"GET",headers:{Accept:"application/json, application/xml, text/xml;q=0.9, */*;q=0.8"},cache:"no-store"}); if(!res.ok) throw new Error(`HTTP ${res.status}: ${url}`); const text=(await res.text()).trim(); if(!text) return {response:{header:{resultCode:"EMPTY"},body:{items:[]}}}; if(text.startsWith("{")||text.startsWith("[")) return JSON.parse(text); return {response:{header:{resultCode:"XML"},body:{items:{item:xmlItemsToObjects(text)}}}}; }
function unwrapItems(payload) { const body=payload?.response?.body ?? payload?.body ?? payload; const header=payload?.response?.header ?? payload?.header ?? {}; const raw=body?.items?.item ?? body?.items ?? []; return { header, items: Array.isArray(raw) ? raw : raw ? [raw] : [] }; }
function getRecentMonths(count = 24) { const list=[]; const d=new Date(); d.setDate(1); for(let i=0;i<count;i+=1){ list.push(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}`); d.setMonth(d.getMonth()-1);} return list; }
function getTradeApartmentName(item) { return normalizeText(item.aptNm || item.아파트 || item.offiNm || item.단지 || item.apartmentName || ""); }
function getTradeJibun(item) { return normalizeJibun(item.jibun || item.지번 || item.lotNo || ""); }
function getTradeArea(item) { return Number(item.excluUseAr || item.전용면적 || item.area || 0); }
function getTradeAmountWon(item) { const raw=item.dealAmount ?? item.거래금액 ?? item.price ?? item.amount ?? ""; const manwon=Number(String(raw).replace(/[^0-9.]/g,"")); return Number.isFinite(manwon) && manwon>0 ? Math.round(manwon*10000) : 0; }
function getTradeDateKey(item) { const y=String(item.dealYear || item.년 || item.year || "").padStart(4,"0"); const m=String(item.dealMonth || item.월 || item.month || "").padStart(2,"0"); const d=String(item.dealDay || item.일 || item.day || "01").padStart(2,"0"); return `${y}-${m}-${d}`; }
function toleranceForArea(areaNumber) { if(!Number.isFinite(areaNumber)) return 1.5; if(areaNumber<40) return 0.8; if(areaNumber<85) return 1.5; if(areaNumber<150) return 2.5; return 4; }
async function loadPropertyMasterLocal() { const cands=[`${process.cwd()}/public/property-master.json`, `${process.cwd()}/property-master.json`]; for(const p of cands){ try{ const fs=await import("fs/promises"); return { master: JSON.parse(await fs.readFile(p,"utf-8")) }; } catch(_e){} } throw new Error("property-master.json 파일을 찾지 못했습니다."); }
function nameSimilarityScore(sourceName, targetName) { const a=normalizeApartmentName(sourceName); const b=normalizeApartmentName(targetName); if(!a||!b) return 0; if(a===b) return 100; if(a.includes(b)||b.includes(a)) return 85; let common=0; for(const ch of new Set(a.split(""))) if(b.includes(ch)) common+=1; return Math.round((common/Math.max(new Set(a.split("")).size,new Set(b.split("")).size,1))*100); }
function pickCatalogEntry(master, query) {
  const rows = master?.[query.propertyType]?.[query.city] || [];
  const targetName = normalizeApartmentName(query.apartment);
  const targetArea = parseAreaNumber(query.area);
  const byTown = rows.filter((row)=>row.district===query.district && row.town===query.town);
  if(!byTown.length) return null;
  const exact = byTown.filter((row)=>normalizeApartmentName(row.apartment)===targetName);
  const loose = exact.length ? exact : byTown.map((row)=>({row,score:nameSimilarityScore(row.apartment,query.apartment)})).filter((x)=>x.score>=70).sort((a,b)=>b.score-a.score).map((x)=>x.row);
  const candidates = loose.length ? loose : byTown;
  if(!Number.isFinite(targetArea)) return candidates[0] || null;
  const areaMatched = candidates.find((row)=>Array.isArray(row.areas)&&row.areas.some((area)=>Math.abs(parseAreaNumber(area)-targetArea)<=toleranceForArea(targetArea)));
  return areaMatched || candidates[0] || null;
}
function summarizeRows(query, rows, trendText, extraWarning = "") {
  const amounts = rows.map((r)=>r.amountWon).filter(Boolean);
  if (!amounts.length) throw new Error("조회값 없음");
  const latest = rows.slice().sort((a,b)=>String(b.dealDate).localeCompare(String(a.dealDate)))[0];
  const low = Math.min(...amounts); const high = Math.max(...amounts); const avg = Math.round(amounts.reduce((s,v)=>s+v,0)/amounts.length);
  const ratio = query.propertyType === "아파트" ? 0.72 : query.propertyType === "오피스텔" ? 0.68 : 0.62;
  return {
    ok:true,
    source: "trade-cache",
    count: rows.length,
    summary: {
      title: query.apartment,
      address: [query.city, query.district, query.town].filter(Boolean).join(" "),
      area: formatArea(query.area),
      tradeDate: latest.dealDate,
      latestPrice: formatEok(latest.amountWon),
      range: `${formatEok(low)} ~ ${formatEok(high)}`,
      averagePrice: formatEok(avg),
      estimateLimit: `최대 ${formatEok(Math.round(latest.amountWon * ratio))} 가능`,
      description: `저장된 실거래 캐시 ${rows.length}건을 기준으로 계산한 결과입니다. 최근 실거래가 ${formatEok(latest.amountWon)}, 평균 ${formatEok(avg)} 수준입니다.`,
      trendText,
    },
    ...(extraWarning ? { warning: extraWarning } : {}),
  };
}

async function queryTradeCache(query) {
  if (!isSupabaseConfigured()) return null;
  const { master } = await loadPropertyMasterLocal();
  const entry = pickCatalogEntry(master, query);
  if (!entry) return null;
  const rawLawdCode = entry?.bjdCode || entry?.lawdCode;
  if (!rawLawdCode) return null;
  const lawdCode = String(rawLawdCode).slice(0,5);
  const targetJibun = normalizeJibun(entry?.jibun || "");
  const targetName = normalizeApartmentName(query.apartment);
  const targetArea = parseAreaNumber(query.area);
  const areaTol = toleranceForArea(targetArea);
  const dateCutoff = new Date(); dateCutoff.setMonth(dateCutoff.getMonth()-60);

  const baseRows = await supabaseRest("/apartment_trade_cache", {
    query: {
      select: "id,apartment_name,apartment_name_norm,jibun,area_m2,deal_date,amount_won,city,district,town,lawd_code",
      property_type: `eq.${query.propertyType}`,
      lawd_code: `eq.${lawdCode}`,
      deal_date: `gte.${dateCutoff.toISOString().slice(0,10)}`,
      order: "deal_date.desc",
      limit: "5000",
    },
  }).catch(()=>[]);
  const rows = Array.isArray(baseRows) ? baseRows : [];
  if (!rows.length) return null;

  const normalized = rows.map((row)=>({
    ...row,
    jibunNorm: normalizeJibun(row.jibun || ""),
    tradeName: normalizeApartmentName(row.apartment_name || row.apartment_name_norm || ""),
    area: Number(row.area_m2 || 0),
    amountWon: Number(row.amount_won || 0),
    dealDate: String(row.deal_date || ""),
  })).filter((row)=>row.amountWon>0);
  if (!normalized.length) return null;

  const exact = normalized.filter((row)=>{
    const jibunOk = targetJibun && row.jibunNorm ? row.jibunNorm === targetJibun : false;
    const nameOk = row.tradeName === targetName || row.tradeName.includes(targetName) || targetName.includes(row.tradeName);
    const areaOk = !Number.isFinite(targetArea) || !Number.isFinite(row.area) || Math.abs(row.area-targetArea)<=areaTol;
    return jibunOk && nameOk && areaOk;
  });
  if (exact.length) return summarizeRows(query, exact, `캐시 실거래 exact ${exact.length}건`);

  const nameArea = normalized.filter((row)=>{
    const nameScore = nameSimilarityScore(row.apartment_name, query.apartment);
    const nameOk = row.tradeName === targetName || row.tradeName.includes(targetName) || targetName.includes(row.tradeName) || nameScore >= 85;
    const areaOk = !Number.isFinite(targetArea) || !Number.isFinite(row.area) || Math.abs(row.area-targetArea)<=areaTol;
    return nameOk && areaOk;
  });
  if (nameArea.length) return summarizeRows(query, nameArea, `캐시 단지·면적 매칭 ${nameArea.length}건`);

  const sameJibun = normalized.filter((row)=>targetJibun && row.jibunNorm && row.jibunNorm === targetJibun);
  if (sameJibun.length && Number.isFinite(targetArea)) {
    const priceRows = sameJibun.filter((row)=>Number.isFinite(row.area) && row.area > 0);
    if (priceRows.length) {
      const weighted = priceRows.reduce((sum,row)=>sum + row.amountWon/row.area,0)/priceRows.length;
      const estimated = Math.round(weighted * targetArea);
      return {
        ok:true,
        source: "trade-cache-estimated",
        count: priceRows.length,
        summary: {
          title: query.apartment,
          address: [query.city, query.district, query.town].filter(Boolean).join(" "),
          area: formatArea(query.area),
          tradeDate: priceRows[0].dealDate,
          latestPrice: formatEok(estimated),
          range: `${formatEok(Math.round(estimated*0.95))} ~ ${formatEok(Math.round(estimated*1.05))}`,
          averagePrice: formatEok(estimated),
          estimateLimit: `최대 ${formatEok(Math.round(estimated*0.72))} 가능`,
          description: `같은 지번의 최근 실거래 ${priceRows.length}건을 기준으로 ㎡당 가격을 환산한 추정값입니다.`,
          trendText: `캐시 지번 기반 추정 ${priceRows.length}건`,
        },
        warning: "선택 면적의 exact 거래가 없어 동일 지번 기준 추정값으로 표시했습니다.",
      };
    }
  }

  const sameTown = normalized.filter((row)=>row.city===query.city && row.district===query.district && row.town===query.town);
  if (sameTown.length && Number.isFinite(targetArea)) {
    const nearest = sameTown.filter((row)=>Number.isFinite(row.area) && Math.abs(row.area-targetArea)<=Math.max(areaTol*2,6));
    if (nearest.length) {
      return summarizeRows(query, nearest, `동일 동네 유사 면적 ${nearest.length}건`, "exact 거래가 없어 동일 동네 유사 면적 참고값으로 표시했습니다.");
    }
  }
  return null;
}

function buildStatFallback(query) { return { source: "fallback", count: 0, summary: { title: query.apartment || `${query.town} 대표 단지`, address: [query.city, query.district, query.town].filter(Boolean).join(" "), area: formatArea(query.area), tradeDate: "통계 기준", latestPrice: "조회값 없음", range: "조회값 없음", averagePrice: "조회값 없음", estimateLimit: "상담 후 산정", description: "실거래가 데이터가 없어 통계형 참고값으로 대체 표시합니다.", trendText: "실거래 데이터 없음" } }; }
function normalizeItems(payload) { if(Array.isArray(payload)) return payload; if(Array.isArray(payload?.SttsApiTblData)) return payload.SttsApiTblData; if(Array.isArray(payload?.response?.body?.items)) return payload.response.body.items; if(Array.isArray(payload?.items)) return payload.items; return []; }
function pickLatestItem(items = []) { if (!items.length) return null; return [...items].sort((a,b)=>String(b.WRTTIME_IDTFR_ID || b.wrttimeIdtfrId || b.date || "").localeCompare(String(a.WRTTIME_IDTFR_ID || a.wrttimeIdtfrId || a.date || "")))[0]; }
function makeSummaryFromStat(item, fallbackSummary, query) { if(!item) return fallbackSummary; const raw=Number(item.DT || item.dt || item.VALUE || item.value || item.PRICE || item.price || 0); if(!raw) return fallbackSummary; const numericValue = raw < 10000 ? raw * 1000000 : raw; const low=Math.round(numericValue*0.96); const high=Math.round(numericValue*1.04); const ratio=query.propertyType==="아파트"?0.72:query.propertyType==="오피스텔"?0.68:0.62; return { ...fallbackSummary, tradeDate:String(item.WRTTIME_IDTFR_ID || item.wrttimeIdtfrId || fallbackSummary.tradeDate), latestPrice:formatEok(numericValue), range:`${formatEok(low)} ~ ${formatEok(high)}`, averagePrice:formatEok(numericValue), estimateLimit:`최대 ${formatEok(Math.round(numericValue*ratio))} 가능`, description:`${fallbackSummary.address} ${fallbackSummary.title} 기준의 한국부동산원 공개 통계 참고값입니다. 단지·면적별 실거래가가 아닐 수 있습니다.`, trendText:"통계 참고값" }; }
async function fetchStatSummary(query) { const key = process.env.REB_OPENAPI_KEY; const statId = PROPERTY_STAT_ID_MAP[query.propertyType]; const fallback = buildStatFallback(query); if(!key||!statId) return { ...fallback, warning: "실거래가 API와 통계 API 설정이 모두 없어 결과를 제공하지 못했습니다." }; const url = new URL(REB_API_BASE); url.searchParams.set("KEY", key); url.searchParams.set("Type","json"); url.searchParams.set("STATBL_ID", statId); url.searchParams.set("pIndex","1"); url.searchParams.set("pSize","30"); const res=await fetch(url.toString(),{cache:"no-store"}); if(!res.ok) return { ...fallback, warning:`R-ONE API 호출 실패 (${res.status})`}; const payload=await res.json(); const items=normalizeItems(payload); return { source: items.length ? "reb-openapi" : "fallback", count: items.length, summary: makeSummaryFromStat(pickLatestItem(items), fallback.summary, query), warning: "최근 실거래가를 찾지 못해 통계형 참고값으로 대체했습니다."}; }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = { propertyType: searchParams.get("propertyType") || "아파트", city: searchParams.get("city") || "", district: searchParams.get("district") || "", town: searchParams.get("town") || "", apartment: searchParams.get("apartment") || "", area: searchParams.get("area") || "" };
  if (!query.city || !query.district || !query.town || !query.apartment || !query.area) return NextResponse.json({ ok:false, message:"시도, 시군구, 읍면동, 아파트, 면적을 모두 선택해 주세요." }, { status:400 });
  try {
    const cached = await queryTradeCache(query).catch(()=>null);
    if (cached?.summary?.latestPrice && cached.summary.latestPrice !== "조회값 없음") return NextResponse.json({ ...cached, query });
    throw new Error("캐시된 실거래가를 찾지 못했습니다.");
  } catch (cacheError) {
    const stat = await fetchStatSummary(query).catch(() => buildStatFallback(query));
    return NextResponse.json({ ok:true, ...stat, query, warning: cacheError?.message || stat?.warning || "최근 실거래가를 찾지 못해 참고값으로 대체했습니다." });
  }
}
