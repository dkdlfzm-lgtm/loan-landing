import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const reviews = await supabaseRest("/reviews", {
      query: {
        select: "id,name,email,title,content,created_at,view_count,status",
        order: "created_at.desc",
        limit: 200,
      },
    });
    return NextResponse.json({ ok: true, reviews: Array.isArray(reviews) ? reviews : [] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "이용후기 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
