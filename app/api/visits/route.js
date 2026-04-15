import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

function sanitize(value) {
  return String(value || "").trim();
}

export async function POST(request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const pagePath = sanitize(body.page_path || body.pagePath || "/");
    const scope = sanitize(body.scope || "pc") || "pc";
    const visitorId = sanitize(body.visitor_id || body.visitorId);
    const sessionId = sanitize(body.session_id || body.sessionId);
    const referrer = sanitize(body.referrer);

    if (!visitorId || !sessionId || !pagePath) {
      return NextResponse.json({ ok: false, message: "방문자 식별값이 없습니다." }, { status: 400 });
    }

    await supabaseRest('/site_visits', {
      method: 'POST',
      prefer: 'return=minimal',
      body: [{
        visitor_id: visitorId,
        session_id: sessionId,
        page_path: pagePath,
        scope,
        referrer: referrer || null,
      }],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '방문자 통계를 저장하지 못했습니다.' }, { status: 500 });
  }
}
