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
    const { status } = await request.json();
    const updated = await supabaseRest(`/reviews?id=eq.${params.id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: { status },
    });
    return NextResponse.json({ ok: true, review: Array.isArray(updated) ? updated[0] : null });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "후기 상태를 수정하지 못했습니다." }, { status: 500 });
  }
}
