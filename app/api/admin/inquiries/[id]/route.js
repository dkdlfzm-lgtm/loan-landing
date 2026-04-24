import { NextResponse } from "next/server";
import { isAdminAccessAuthenticated } from "../../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../lib/supabase-rest";

export async function PATCH(request, { params }) {
  if (!(await isAdminAccessAuthenticated())) return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  try {
    const body = await request.json();
    const assigned_staff_account_id = body.assigned_staff_account_id ? String(body.assigned_staff_account_id).trim() : null;
    const payload = {
      status: String(body.status || '신규접수').trim(),
      job_type: String(body.job_type || '').trim(),
      assignee: String(body.assignee || '미배정').trim(),
      assigned_staff_account_id,
      call_summary: String(body.call_summary || '').trim(),
      internal_memo: String(body.internal_memo || '').trim(),
      email: String(body.email || '').trim(),
      updated_at: new Date().toISOString(),
    };
    const updated = await supabaseRest(`/inquiries?id=eq.${params.id}`, { method: 'PATCH', prefer: 'return=representation', body: payload });
    return NextResponse.json({ ok: true, inquiry: Array.isArray(updated) ? updated[0] : null });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '상담 정보를 수정하지 못했습니다.' }, { status: 500 });
  }
}
