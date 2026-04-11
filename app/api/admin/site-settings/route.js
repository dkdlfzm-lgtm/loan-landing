import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings, parseBoolean } from "../../../../lib/site-settings";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

const FIELD_CONFIG = [
  ["company_name", "text"],
  ["company_subtitle", "text"],
  ["logo_url", "text"],
  ["phone", "text"],
  ["kakao_id", "text"],
  ["kakao_url", "text"],
  ["hero_badge", "text"],
  ["hero_title", "text"],
  ["hero_description", "text"],
  ["hero_feature_1", "text"],
  ["hero_feature_2", "text"],
  ["hero_feature_3", "text"],
  ["hero_primary_cta", "text"],
  ["hero_secondary_cta", "text"],
  ["consult_button_text", "text"],
  ["reviews_enabled", "boolean"],
  ["hero_background_url", "text"],
  ["notice_enabled", "boolean"],
  ["notice_text", "text"],
  ["popup_enabled", "boolean"],
  ["popup_title", "text"],
  ["popup_description", "text"],
  ["popup_button_text", "text"],
  ["popup_button_url", "text"],
  ["middle_banner_enabled", "boolean"],
  ["middle_banner_badge", "text"],
  ["middle_banner_title", "text"],
  ["middle_banner_description", "text"],
  ["middle_banner_button_text", "text"],
  ["middle_banner_button_url", "text"],
  ["representative_name", "text"],
  ["business_registration_number", "text"],
  ["brokerage_registration_number", "text"],
  ["lending_registration_number", "text"],
  ["company_address", "text"],
  ["registration_agency", "text"],
  ["footer_legal_line_1", "text"],
  ["footer_legal_line_2", "text"],
  ["footer_legal_line_3", "text"],
  ["footer_legal_line_4", "text"],
  ["footer_legal_line_5", "text"],
  ["footer_copyright", "text"],
];

const SELECT_FIELDS = FIELD_CONFIG.map(([field]) => field).concat("updated_at").join(",");

export async function GET(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "mobile" ? "mobile" : "main";
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, settings: { ...DEFAULT_SITE_SETTINGS, scope }, fallback: true });
  try {
    const rows = await supabaseRest("/site_settings", {
      query: {
        select: `scope,${SELECT_FIELDS}`,
        scope: `eq.${scope}`,
        limit: 1,
      },
    });
    return NextResponse.json({ ok: true, settings: normalizeSiteSettings({ ...(Array.isArray(rows) ? rows[0] : rows), scope }) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "홈페이지 설정을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "mobile" ? "mobile" : "main";
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try {
    const body = await request.json();
    const payload = { scope };
    for (const [field, type] of FIELD_CONFIG) {
      if (type === "boolean") {
        payload[field] = parseBoolean(body?.[field], DEFAULT_SITE_SETTINGS[field]);
      } else {
        payload[field] = String(body?.[field] ?? DEFAULT_SITE_SETTINGS[field] ?? "").trim();
      }
    }
    const saved = await supabaseRest("/site_settings", {
      method: "POST",
      query: { on_conflict: "scope" },
      prefer: "resolution=merge-duplicates,return=representation",
      body: [payload],
    });
    return NextResponse.json({ ok: true, settings: normalizeSiteSettings(Array.isArray(saved) ? saved[0] : saved) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "홈페이지 설정을 저장하지 못했습니다." }, { status: 500 });
  }
}
