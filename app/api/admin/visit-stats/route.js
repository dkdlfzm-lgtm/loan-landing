import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayKey(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMonthKey(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - 370);

    const rows = await supabaseRest('/site_visits', {
      query: {
        select: 'id,visitor_id,session_id,page_path,scope,created_at',
        created_at: `gte.${since.toISOString()}`,
        order: 'created_at.desc',
        limit: '20000',
      },
    });

    const visits = Array.isArray(rows) ? rows : [];
    const now = Date.now();
    const todayKey = formatDayKey(now);
    const recentCutoff = now - 5 * 60 * 1000;

    const dailyMap = new Map();
    const monthlyMap = new Map();
    const scopeMap = { pc: new Set(), mobile: new Set() };
    const todayVisitors = new Set();
    const todaySessions = new Set();
    const liveSessions = new Set();

    for (const row of visits) {
      const created = row.created_at;
      const dayKey = formatDayKey(created);
      const monthKey = formatMonthKey(created);
      const visitorId = row.visitor_id || row.session_id || row.id;
      const sessionId = row.session_id || row.id;
      const scope = row.scope === 'mobile' ? 'mobile' : 'pc';

      if (!dailyMap.has(dayKey)) dailyMap.set(dayKey, { date: dayKey, pageviews: 0, visitors: new Set() });
      const day = dailyMap.get(dayKey);
      day.pageviews += 1;
      day.visitors.add(visitorId);

      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { month: monthKey, pageviews: 0, visitors: new Set() });
      const month = monthlyMap.get(monthKey);
      month.pageviews += 1;
      month.visitors.add(visitorId);

      scopeMap[scope].add(visitorId);

      if (dayKey === todayKey) {
        todayVisitors.add(visitorId);
        todaySessions.add(sessionId);
      }

      if (new Date(created).getTime() >= recentCutoff) {
        liveSessions.add(sessionId);
      }
    }

    const daily = [...dailyMap.values()]
      .map((item) => ({ date: item.date, pageviews: item.pageviews, visitors: item.visitors.size }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-31);

    const monthly = [...monthlyMap.values()]
      .map((item) => ({ month: item.month, pageviews: item.pageviews, visitors: item.visitors.size }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return NextResponse.json({
      ok: true,
      summary: {
        live_sessions_5m: liveSessions.size,
        today_unique_visitors: todayVisitors.size,
        today_pageviews: todaySessions.size ? visits.filter((row) => formatDayKey(row.created_at) === todayKey).length : 0,
        monthly_unique_visitors: monthly.length ? monthly[monthly.length - 1].visitors : 0,
        monthly_pageviews: monthly.length ? monthly[monthly.length - 1].pageviews : 0,
        pc_unique_visitors: scopeMap.pc.size,
        mobile_unique_visitors: scopeMap.mobile.size,
      },
      daily,
      monthly,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '방문자 통계를 불러오지 못했습니다.' }, { status: 500 });
  }
}
