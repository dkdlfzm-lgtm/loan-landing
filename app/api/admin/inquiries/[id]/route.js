import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../lib/supabase-rest";

export async function PATCH(request, { params }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const payload = {
      status: String(body.status || "new").trim(),
      job_type: String(body.job_type || "").trim(),
      assignee: String(body.assignee || "미배정").trim(),
      call_summary: String(body.call_summary || "").trim(),
      internal_memo: String(body.internal_memo || "").trim(),
      email: String(body.email || "").trim(),
    };

    const updated = await supabaseRest(`/inquiries?id=eq.${params.id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: payload,
    });
    return NextResponse.json({ ok: true, inquiry: Array.isArray(updated) ? updated[0] : null });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "상담 정보를 수정하지 못했습니다." }, { status: 500 });
  }
}
