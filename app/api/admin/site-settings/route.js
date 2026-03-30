import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from "../../../../lib/site-settings";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

const FIELD_NAMES = [
  'company_name','company_subtitle','phone','kakao_id','kakao_url','hero_badge','hero_title','hero_description','hero_primary_cta','hero_secondary_cta','consult_button_text'
];

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, message: '관리자 인증이 필요합니다.' }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, settings: DEFAULT_SITE_SETTINGS, fallback: true });
  try {
    const rows = await supabaseRest('/site_settings', {
      query: {
        select: 'scope,company_name,company_subtitle,phone,kakao_id,kakao_url,hero_badge,hero_title,hero_description,hero_primary_cta,hero_secondary_cta,consult_button_text,updated_at',
        scope: 'eq.main',
        limit: 1,
      },
    });
    return NextResponse.json({ ok: true, settings: normalizeSiteSettings(Array.isArray(rows) ? rows[0] : rows) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '홈페이지 설정을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, message: '관리자 인증이 필요합니다.' }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: 'Supabase 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  try {
    const body = await request.json();
    const payload = { scope: 'main' };
    for (const field of FIELD_NAMES) {
      payload[field] = String(body?.[field] ?? DEFAULT_SITE_SETTINGS[field] ?? '').trim();
    }
    const saved = await supabaseRest('/site_settings', {
      method: 'POST',
      query: { on_conflict: 'scope' },
      prefer: 'resolution=merge-duplicates,return=representation',
      body: [payload],
    });
    return NextResponse.json({ ok: true, settings: normalizeSiteSettings(Array.isArray(saved) ? saved[0] : saved) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '홈페이지 설정을 저장하지 못했습니다.' }, { status: 500 });
  }
}
