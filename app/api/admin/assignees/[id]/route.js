import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../lib/supabase-rest";

export async function PATCH(request, { params }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try {
    const body = await request.json();
    const payload = {
      status: String(body.status || 'active').trim(),
      note: body.note === undefined ? undefined : String(body.note || '').trim(),
    };
    const updated = await supabaseRest(`/staff_members?id=eq.${params.id}`, { method: 'PATCH', prefer: 'return=representation', body: payload });
    return NextResponse.json({ ok: true, assignee: Array.isArray(updated) ? updated[0] : null });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "담당자 정보를 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try {
    await supabaseRest(`/staff_members?id=eq.${params.id}`, { method: 'DELETE' });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "담당자를 삭제하지 못했습니다." }, { status: 500 });
  }
}
