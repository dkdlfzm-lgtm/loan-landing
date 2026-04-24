import { NextResponse } from "next/server";
import { isAdminAccessAuthenticated } from "../../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../lib/supabase-rest";
import { hashStaffPassword, normalizeStaffRole } from "../../../../../lib/staff-auth";

export async function PATCH(request, { params }) {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });

  try {
    const body = await request.json();
    const payload = {
      display_name: body.display_name === undefined ? undefined : String(body.display_name || "").trim(),
      status: body.status === undefined ? undefined : String(body.status || "active").trim(),
      staff_member_id: body.staff_member_id === undefined ? undefined : (body.staff_member_id ? String(body.staff_member_id).trim() : null),
      role: body.role === undefined ? undefined : normalizeStaffRole(body.role),
      updated_at: new Date().toISOString(),
    };

    if (body.password !== undefined) {
      const normalized = String(body.password || "").trim();
      if (normalized) payload.password_hash = hashStaffPassword(normalized);
    }

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    const updated = await supabaseRest(`/staff_accounts?id=eq.${params.id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: payload,
    });
    return NextResponse.json({ ok: true, account: Array.isArray(updated) ? updated[0] : updated });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "직원 계정을 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });

  try {
    await supabaseRest(`/staff_accounts?id=eq.${params.id}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "직원 계정을 삭제하지 못했습니다." }, { status: 500 });
  }
}
