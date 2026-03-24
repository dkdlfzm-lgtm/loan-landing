import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../../../lib/supabase-rest";

export async function POST(request, { params }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, content } = body || {};
    if (![name, content].every((value) => String(value || "").trim())) {
      return NextResponse.json({ ok: false, message: "댓글 작성자와 내용을 입력해주세요." }, { status: 400 });
    }

    const inserted = await supabaseRest("/review_comments", {
      method: "POST",
      prefer: "return=representation",
      body: [{
        review_id: params.id,
        name: String(name).trim(),
        content: String(content).trim(),
      }],
    });

    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    return NextResponse.json({ ok: true, comment: row });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "댓글을 등록하지 못했습니다." }, { status: 500 });
  }
}
