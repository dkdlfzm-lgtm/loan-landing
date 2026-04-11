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
  "representative_name",
  "business_registration_number",
  "brokerage_registration_number",
  "lending_registration_number",
  "company_address",
  "registration_agency",
  "footer_legal_line_1",
  "footer_legal_line_2",
  "footer_legal_line_3",
  "footer_legal_line_4",
  "footer_legal_line_5",
  "footer_copyright",
  "updated_at",
].join(",");

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "mobile" ? "mobile" : "main";

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, settings: { ...DEFAULT_SITE_SETTINGS, scope }, fallback: true });
  }

  async function fetchScope(targetScope) {
    const rows = await supabaseRest("/site_settings", {
      query: {
        select: `scope,${SELECT_FIELDS}`,
        scope: `eq.${targetScope}`,
        limit: 1,
      },
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  try {
    if (scope === "mobile") {
      const [mainRow, mobileRow] = await Promise.all([fetchScope("main"), fetchScope("mobile")]);
      const merged = { ...(mainRow || {}), ...(mobileRow || {}), scope: "mobile" };
      return NextResponse.json({ ok: true, settings: normalizeSiteSettings(merged), resolvedScope: mobileRow ? "mobile" : "main", fallback: !mainRow && !mobileRow });
    }

    const row = await fetchScope("main");
    return NextResponse.json({ ok: true, settings: normalizeSiteSettings({ ...row, scope: "main" }), resolvedScope: "main", fallback: !row });
  } catch {
    return NextResponse.json({ ok: true, settings: { ...DEFAULT_SITE_SETTINGS, scope }, fallback: true });
  }
}
