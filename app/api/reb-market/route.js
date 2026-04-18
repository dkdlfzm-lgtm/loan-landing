import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import fs from "fs/promises";

const REB_API_BASE = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do";
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
  const m = String(value ?? "").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

function formatArea(value) {
  const n = parseAreaNumber(value);
  return Number.isFinite(n) ? `${Number(n.toFixed(2))}㎡` : String(value || "선택 면적");
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

function toleranceForArea(areaNumber) {
  if (!Number.isFinite(areaNumber)) return 1.5;
  if (areaNumber < 40) return 1.0;
  if (areaNumber < 85) return 2.0;
  if (areaNumber < 150) return 3.5;
  return 5.0;
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

  return Math.round(
    (common / Math.max(new Set(a.split("")).size, new Set(b.split("")).size, 1)) * 100
  );
}

async function loadPropertyMasterLocal(requestUrl = "") {
  const fileErrors = [];
  for (const filePath of [
    `${process.cwd()}/public/property-master.json`,
    `${process.cwd()}/property-master.json`,
  ]) {
    try {
      return JSON.parse(await fs.readFile(filePath, "utf-8"));
    } catch (err) {
      fileErrors.push(`${filePath}: ${err?.code || err?.message || err}`);
    }
  }

  const urls = [];
  if (requestUrl) {
    try {
      urls.push(`${new URL(requestUrl).origin}/property-master.json`);
    } catch {}
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    urls.push(`${String(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "")}/property-master.json`);
  }
  if (process.env.VERCEL_URL) {
    urls.push(`https://${String(process.env.VERCEL_URL).replace(/^https?:\/\//, "")}/property-master.json`);
  }

  const urlErrors = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        urlErrors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      urlErrors.push(`${url}: ${err?.message || err}`);
    }
  }

  throw new Error(`property-master.json 파일을 찾지 못했습니다. ${fileErrors.concat(urlErrors).join(" | ")}`);
}

function pickCatalogEntry(master, query) {
  const rows = master?.[query.propertyType]?.[query.city] || [];
  const byTown = rows.filter(
    (row) => row.district === query.district && row.town === query.town
  );
  if (!byTown.length) return null;

  const targetArea = parseAreaNumber(query.area);

  const sorted = byTown
    .map((row) => ({
      row,
      score: nameSimilarityScore(row.apartment, query.apartment),
    }))
    .sort((a, b) => b.score - a.score);

  const candidates = sorted.filter((x) => x.score >= 68).map((x) => x.row);
  const chosen = candidates.length ? candidates : byTown;

  const matched = chosen.find(
    (row) =>
      Array.isArray(row.areas) &&
      row.areas.some(
        (area) =>
          Math.abs(parseAreaNumber(area) - targetArea) <= toleranceForArea(targetArea)
      )
  );

  return matched || chosen[0] || null;
}

function buildSummary(query, rows, label, options = {}) {
  const sorted = [...rows].sort((a, b) =>
    String(b.deal_date).localeCompare(String(a.deal_date))
  );
  const latest = sorted[0];
  const amounts = sorted.map((row) => Number(row.amount_won || 0)).filter(Boolean);
  const avg = Math.round(
    amounts.reduce((s, v) => s + v, 0) / Math.max(amounts.length, 1)
  );
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);

  return {
    source: options.source || "trade-cache",
    count: sorted.length,
    summary: {
      title: query.apartment,
      address: [query.city, query.district, query.town].filter(Boolean).join(" "),
      area: formatArea(query.area),
      tradeDate: latest?.deal_date || "캐시 기준",
      latestPrice: formatEok(latest?.amount_won || 0),
      range: amounts.length ? `${formatEok(low)} ~ ${formatEok(high)}` : "조회값 없음",
      averagePrice: amounts.length ? formatEok(avg) : "조회값 없음",
      estimateLimit: latest?.amount_won
        ? `최대 ${formatEok(Math.round(Number(latest.amount_won) * 0.72))} 가능`
        : "상담 후 산정",
      description:
        options.description ||
        `캐시에 저장된 최근 ${sorted.length}건의 실거래 데이터를 기준으로 계산한 결과입니다.`,
      trendText: label,
    },
    ...(options.warning ? { warning: options.warning } : {}),
  };
}

function buildEstimatedSummary(query, baseRow, estimatedWon, label, warning) {
  return {
    source: "trade-cache-estimated",
    count: 1,
    summary: {
      title: query.apartment,
      address: [query.city, query.district, query.town].filter(Boolean).join(" "),
      area: formatArea(query.area),
      tradeDate: baseRow?.deal_date || "캐시 기준",
      latestPrice: formatEok(estimatedWon),
      range: formatEok(estimatedWon),
      averagePrice: formatEok(estimatedWon),
      estimateLimit: `최대 ${formatEok(Math.round(estimatedWon * 0.72))} 가능`,
      description:
        "캐시에 저장된 최근 유사 실거래 데이터를 기준으로 ㎡당 가격을 환산한 추정값입니다.",
      trendText: label,
    },
    warning,
  };
}

async function fetchCacheSummary(query) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }

  const master = await loadPropertyMasterLocal(request.url);
  const entry = pickCatalogEntry(master, query);

  if (!entry) throw new Error("단지 정보를 property-master.json에서 찾지 못했습니다.");

  const lawdCode = String(entry?.bjdCode || entry?.lawdCode || "").slice(0, 5);
  if (!lawdCode) throw new Error("단지 코드 정보를 찾지 못했습니다.");

  const targetName = normalizeApartmentName(query.apartment);
  const targetArea = parseAreaNumber(query.area);
  const targetJibun = normalizeJibun(entry?.jibun || "");

  const rows = await supabaseRest("/apartment_trade_cache", {
    query: {
      select:
        "lawd_code,district,town,apartment_name,apartment_name_norm,jibun,area_m2,deal_date,amount_won,price_per_m2",
      property_type: `eq.${query.propertyType}`,
      lawd_code: `eq.${lawdCode}`,
      order: "deal_date.desc",
      limit: "5000",
    },
  });

  const all = Array.isArray(rows) ? rows : [];
  if (!all.length) {
    throw new Error(
      "캐시에 저장된 실거래 데이터가 없습니다. 실거래가 관리에서 전체 적재를 먼저 실행해 주세요."
    );
  }

  const enriched = all
    .map((row) => {
      const area = Number(row.area_m2);
      const nameNorm = row.apartment_name_norm || normalizeApartmentName(row.apartment_name);
      const nameScore = nameSimilarityScore(row.apartment_name, query.apartment);
      const areaDiff =
        Number.isFinite(targetArea) && Number.isFinite(area)
          ? Math.abs(area - targetArea)
          : Number.POSITIVE_INFINITY;
      const jibunNorm = normalizeJibun(row.jibun);
      return {
        ...row,
        area_m2_num: area,
        nameNorm,
        nameScore,
        areaDiff,
        jibunNorm,
      };
    })
    .filter((row) => row.amount_won);

  const exact = enriched.filter((row) => {
    const jibunOk = targetJibun && row.jibunNorm === targetJibun;
    const nameOk =
      row.nameNorm === targetName ||
      row.nameNorm?.includes(targetName) ||
      targetName.includes(row.nameNorm || "");
    const areaOk =
      !Number.isFinite(targetArea) ||
      !Number.isFinite(row.area_m2_num) ||
      row.areaDiff <= toleranceForArea(targetArea);
    return jibunOk && nameOk && areaOk;
  });
  if (exact.length) {
    return buildSummary(query, exact, "지번·단지명·면적 정확 매칭");
  }

  const sameNameArea = enriched.filter((row) => {
    const areaOk =
      !Number.isFinite(targetArea) ||
      !Number.isFinite(row.area_m2_num) ||
      row.areaDiff <= toleranceForArea(targetArea);
    return row.nameScore >= 84 && areaOk;
  });
  if (sameNameArea.length) {
    return buildSummary(query, sameNameArea, "단지명·면적 유사 매칭");
  }

  const sameNameAnyArea = enriched
    .filter((row) => row.nameScore >= 84 && Number.isFinite(row.area_m2_num))
    .sort(
      (a, b) =>
        a.areaDiff - b.areaDiff ||
        String(b.deal_date).localeCompare(String(a.deal_date))
    );
  if (sameNameAnyArea.length && Number.isFinite(targetArea)) {
    const nearest = sameNameAnyArea[0];
    const estimated =
      nearest.price_per_m2 && Number(nearest.price_per_m2) > 0
        ? Math.round(Number(nearest.price_per_m2) * targetArea)
        : Math.round((Number(nearest.amount_won) / Math.max(nearest.area_m2_num, 1)) * targetArea);

    return buildEstimatedSummary(
      query,
      nearest,
      estimated,
      "동일 단지 유사 면적 추정",
      "정확히 같은 면적 거래가 없어 동일 단지의 최근 유사 면적 실거래로 추정했습니다."
    );
  }

  const sameJibun = enriched.filter((row) => targetJibun && row.jibunNorm === targetJibun);
  if (sameJibun.length) {
    const withArea = sameJibun
      .filter((row) => Number.isFinite(row.area_m2_num) && row.area_m2_num > 0)
      .sort(
        (a, b) =>
          a.areaDiff - b.areaDiff ||
          String(b.deal_date).localeCompare(String(a.deal_date))
      );
    if (withArea.length && Number.isFinite(targetArea)) {
      const nearest = withArea[0];
      const estimated =
        nearest.price_per_m2 && Number(nearest.price_per_m2) > 0
          ? Math.round(Number(nearest.price_per_m2) * targetArea)
          : Math.round((Number(nearest.amount_won) / nearest.area_m2_num) * targetArea);

      return buildEstimatedSummary(
        query,
        nearest,
        estimated,
        "동일 지번 유사 면적 추정",
        "정확히 같은 단지/면적 거래가 없어 동일 지번의 유사 면적 실거래로 추정했습니다."
      );
    }
    return buildSummary(query, sameJibun, "동일 지번 참고");
  }

  const nearby = enriched
    .filter(
      (row) =>
        Number.isFinite(row.area_m2_num) &&
        Number.isFinite(targetArea) &&
        Math.abs(row.area_m2_num - targetArea) <= 5
    )
    .sort(
      (a, b) =>
        b.nameScore - a.nameScore ||
        String(b.deal_date).localeCompare(String(a.deal_date))
    )
    .slice(0, 20);
  if (nearby.length) {
    return buildSummary(query, nearby, "같은 법정동 유사 면적 참고", {
      warning: "동일 단지 매칭 데이터가 부족해 같은 법정동의 유사 면적 거래를 참고값으로 표시했습니다.",
    });
  }

  const nearestAny = enriched
    .filter((row) => Number.isFinite(row.area_m2_num) && Number.isFinite(targetArea))
    .sort(
      (a, b) =>
        a.areaDiff - b.areaDiff ||
        b.nameScore - a.nameScore ||
        String(b.deal_date).localeCompare(String(a.deal_date))
    );
  if (nearestAny.length) {
    const nearest = nearestAny[0];
    const estimated =
      nearest.price_per_m2 && Number(nearest.price_per_m2) > 0
        ? Math.round(Number(nearest.price_per_m2) * targetArea)
        : Math.round((Number(nearest.amount_won) / Math.max(nearest.area_m2_num, 1)) * targetArea);

    return buildEstimatedSummary(
      query,
      nearest,
      estimated,
      "같은 법정동 최근 유사 거래 추정",
      "정확히 일치하는 캐시 거래가 없어 같은 법정동의 최근 유사 거래를 기준으로 추정했습니다."
    );
  }

  throw new Error("캐시에서 일치하는 실거래가를 찾지 못했습니다.");
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
  return [...items].sort((a, b) =>
    String(b.WRTTIME_IDTFR_ID || b.wrttimeIdtfrId || "").localeCompare(
      String(a.WRTTIME_IDTFR_ID || a.wrttimeIdtfrId || "")
    )
  )[0];
}

function makeSummaryFromStat(item, query) {
  const rawValue = Number(
    item?.DT || item?.dt || item?.VALUE || item?.value || item?.PRICE || item?.price || 0
  );
  if (!rawValue) return null;
  const numericValue = rawValue < 10000 ? rawValue * 1000000 : rawValue;
  return {
    source: "reb-openapi",
    count: 1,
    summary: {
      title: query.apartment,
      address: [query.city, query.district, query.town].filter(Boolean).join(" "),
      area: formatArea(query.area),
      tradeDate: String(item.WRTTIME_IDTFR_ID || item.wrttimeIdtfrId || "통계 기준"),
      latestPrice: formatEok(numericValue),
      range: `${formatEok(Math.round(numericValue * 0.96))} ~ ${formatEok(
        Math.round(numericValue * 1.04)
      )}`,
      averagePrice: formatEok(numericValue),
      estimateLimit: `최대 ${formatEok(Math.round(numericValue * 0.72))} 가능`,
      description: "실거래 캐시가 없어서 한국부동산원 통계 참고값으로 대체합니다.",
      trendText: "통계 참고값",
    },
  };
}

async function fetchStatSummary(query) {
  const key = process.env.REB_OPENAPI_KEY;
  const statId = PROPERTY_STAT_ID_MAP[query.propertyType];
  if (!key || !statId) return null;

  const url = new URL(REB_API_BASE);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("STATBL_ID", statId);
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "30");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  const items = normalizeItems(payload);
  return makeSummaryFromStat(pickLatestItem(items), query);
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
      {
        ok: false,
        message: "시도, 시군구, 읍면동, 아파트, 면적을 모두 선택해 주세요.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await fetchCacheSummary(query);
    return NextResponse.json({ ok: true, ...result, query });
  } catch (error) {
    const stat = await fetchStatSummary(query).catch(() => null);
    if (stat) {
      return NextResponse.json({
        ok: true,
        ...stat,
        query,
        warning: error?.message || "실거래 캐시에서 찾지 못해 통계값으로 대체했습니다.",
      });
    }

    return NextResponse.json({
      ok: true,
      source: "fallback",
      count: 0,
      summary: {
        title: query.apartment,
        address: [query.city, query.district, query.town].filter(Boolean).join(" "),
        area: formatArea(query.area),
        tradeDate: "통계 기준",
        latestPrice: "조회값 없음",
        range: "조회값 없음",
        averagePrice: "조회값 없음",
        estimateLimit: "상담 후 산정",
        description:
          "캐시와 통계 모두에서 값을 찾지 못했습니다. 관리자페이지에서 전체 적재를 먼저 실행해 주세요.",
        trendText: "실거래 데이터 없음",
      },
      query,
      warning: error?.message || "조회값 없음",
    });
  }
}
