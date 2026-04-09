import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

function makePlaceholderEmail() {
  return `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@admin.local`;
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "approval-case")).digest("hex");
}

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
    return NextResponse.json({ ok: false, message: error.message || "승인사례 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name || body?.title || "관리자 등록 사례").trim() || "관리자 등록 사례";
    const title = String(body?.title || body?.name || "").trim() || name;
    const content = String(body?.content || "").trim();
    const status = body?.status === "hidden" ? "hidden" : "published";

    if (!name || !content) {
      return NextResponse.json({ ok: false, message: "고객이름과 내용을 입력해주세요." }, { status: 400 });
    }

    const inserted = await supabaseRest("/reviews", {
      method: "POST",
      prefer: "return=representation",
      body: [{
        name,
        email: makePlaceholderEmail(),
        password_hash: hashValue(`${title}:${Date.now()}`),
        title,
        content,
        status,
      }],
    });

    return NextResponse.json({ ok: true, review: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "승인사례를 등록하지 못했습니다." }, { status: 500 });
  }
}
