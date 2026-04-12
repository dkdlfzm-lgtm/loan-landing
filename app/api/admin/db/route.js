import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

const TABLES = {
  inquiries: {
    path: "/inquiries",
    primaryKey: "id",
    select: "id,name,phone,email,address,loan_type,memo,source_page,property_type,city,district,town,apartment,area,status,job_type,assignee,assigned_staff_account_id,call_summary,internal_memo,created_at,updated_at",
    order: "created_at.desc",
    limit: 300,
    editableFields: ["name","phone","email","address","loan_type","memo","status","job_type","assignee","assigned_staff_account_id","call_summary","internal_memo"],
    deletable: true,
  },
  reviews: {
    path: "/reviews",
    primaryKey: "id",
    select: "id,name,title,content,status,view_count,created_at,updated_at",
    order: "created_at.desc",
    limit: 200,
    editableFields: ["name","title","content","status"],
    deletable: true,
  },
  staff_accounts: {
    path: "/staff_accounts",
    primaryKey: "id",
    select: "id,username,display_name,status,staff_member_id,created_at,updated_at",
    order: "created_at.desc",
    limit: 200,
    editableFields: ["display_name","status","staff_member_id"],
    deletable: true,
  },
  staff_members: {
    path: "/staff_members",
    primaryKey: "id",
    select: "id,name,status,note,created_at",
    order: "created_at.desc",
    limit: 200,
    editableFields: ["name","status","note"],
    deletable: true,
  },
  site_settings: {
    path: "/site_settings",
    primaryKey: "scope",
    select: "scope,company_name,company_subtitle,logo_url,phone,kakao_id,kakao_url,hero_badge,hero_title,hero_description,hero_feature_1,hero_feature_2,hero_feature_3,hero_primary_cta,hero_secondary_cta,consult_button_text,reviews_enabled,hero_background_url,notice_enabled,notice_text,popup_enabled,popup_title,popup_description,popup_button_text,popup_button_url,middle_banner_enabled,middle_banner_badge,middle_banner_title,middle_banner_description,middle_banner_button_text,middle_banner_button_url,updated_at",
    order: "scope.asc",
    limit: 10,
    editableFields: ["company_name","company_subtitle","logo_url","phone","kakao_id","kakao_url","hero_badge","hero_title","hero_description","hero_feature_1","hero_feature_2","hero_feature_3","hero_primary_cta","hero_secondary_cta","consult_button_text","reviews_enabled","hero_background_url","notice_enabled","notice_text","popup_enabled","popup_title","popup_description","popup_button_text","popup_button_url","middle_banner_enabled","middle_banner_badge","middle_banner_title","middle_banner_description","middle_banner_button_text","middle_banner_button_url"],
    deletable: false,
  },
};

function getTableConfig(name) {
  return TABLES[String(name || "").trim()];
}

function sanitizePatch(config, body) {
  const payload = {};
  for (const field of config.editableFields) {
    if (!(field in body)) continue;
    const value = body[field];
    if (typeof value === "boolean") {
      payload[field] = value;
    } else if (value === null) {
      payload[field] = null;
    } else {
      payload[field] = String(value ?? "").trim();
    }
  }
  if ("updated_at" in config.select || config.editableFields.includes("updated_at")) {
    payload.updated_at = new Date().toISOString();
  }
  return payload;
}

export async function GET(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") || "inquiries";
  const config = getTableConfig(table);
  if (!config) {
    return NextResponse.json({ ok: false, message: "지원하지 않는 테이블입니다." }, { status: 400 });
  }

  try {
    const rows = await supabaseRest(config.path, {
      query: {
        select: config.select,
        order: config.order,
        limit: config.limit,
      },
    });

    return NextResponse.json({
      ok: true,
      table,
      primaryKey: config.primaryKey,
      editableFields: config.editableFields,
      deletable: config.deletable,
      rows: Array.isArray(rows) ? rows : [],
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "DB 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const table = String(body?.table || "").trim();
    const key = String(body?.key || "").trim();
    const config = getTableConfig(table);
    if (!config) return NextResponse.json({ ok: false, message: "지원하지 않는 테이블입니다." }, { status: 400 });
    if (!key) return NextResponse.json({ ok: false, message: "수정할 행 정보가 필요합니다." }, { status: 400 });

    const payload = sanitizePatch(config, body?.values || {});
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ ok: false, message: "수정할 값이 없습니다." }, { status: 400 });
    }

    const updated = await supabaseRest(`${config.path}?${config.primaryKey}=eq.${encodeURIComponent(key)}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: payload,
    });

    return NextResponse.json({ ok: true, row: Array.isArray(updated) ? updated[0] : updated });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "DB 행을 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") || "";
  const key = searchParams.get("key") || "";
  const config = getTableConfig(table);

  if (!config) return NextResponse.json({ ok: false, message: "지원하지 않는 테이블입니다." }, { status: 400 });
  if (!config.deletable) return NextResponse.json({ ok: false, message: "이 테이블은 삭제를 지원하지 않습니다." }, { status: 400 });
  if (!key) return NextResponse.json({ ok: false, message: "삭제할 행 정보가 필요합니다." }, { status: 400 });

  try {
    await supabaseRest(`${config.path}?${config.primaryKey}=eq.${encodeURIComponent(key)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "DB 행을 삭제하지 못했습니다." }, { status: 500 });
  }
}
