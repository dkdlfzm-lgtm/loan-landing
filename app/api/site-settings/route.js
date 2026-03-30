import { NextResponse } from "next/server";
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from "../../../lib/site-settings";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, settings: DEFAULT_SITE_SETTINGS, fallback: true });
  }

  try {
    const rows = await supabaseRest('/site_settings', {
      query: {
        select: 'scope,company_name,company_subtitle,phone,kakao_id,kakao_url,hero_badge,hero_title,hero_description,hero_primary_cta,hero_secondary_cta,consult_button_text,updated_at',
        scope: 'eq.main',
        limit: 1,
      },
    });
    return NextResponse.json({ ok: true, settings: normalizeSiteSettings(Array.isArray(rows) ? rows[0] : rows) });
  } catch {
    return NextResponse.json({ ok: true, settings: DEFAULT_SITE_SETTINGS, fallback: true });
  }
}
