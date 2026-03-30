import { NextResponse } from "next/server";
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from "../../../lib/site-settings";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

const SELECT_FIELDS = [
  "company_name",
  "company_subtitle",
  "logo_url",
  "phone",
  "kakao_id",
  "kakao_url",
  "hero_badge",
  "hero_title",
  "hero_description",
  "hero_feature_1",
  "hero_feature_2",
  "hero_feature_3",
  "hero_primary_cta",
  "hero_secondary_cta",
  "consult_button_text",
  "reviews_enabled",
  "hero_background_url",
  "notice_enabled",
  "notice_text",
  "popup_enabled",
  "popup_title",
  "popup_description",
  "popup_button_text",
  "popup_button_url",
  "middle_banner_enabled",
  "middle_banner_badge",
  "middle_banner_title",
  "middle_banner_description",
  "middle_banner_button_text",
  "middle_banner_button_url",
  "updated_at",
].join(",");

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, settings: DEFAULT_SITE_SETTINGS, fallback: true });
  }

  try {
    const rows = await supabaseRest("/site_settings", {
      query: {
        select: `scope,${SELECT_FIELDS}`,
        scope: "eq.main",
        limit: 1,
      },
    });
    return NextResponse.json({ ok: true, settings: normalizeSiteSettings(Array.isArray(rows) ? rows[0] : rows) });
  } catch {
    return NextResponse.json({ ok: true, settings: DEFAULT_SITE_SETTINGS, fallback: true });
  }
}
