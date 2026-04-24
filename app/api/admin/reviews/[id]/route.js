import { NextResponse } from "next/server";
import { isSiteManageAuthenticated } from "../../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../../lib/supabase-rest";
import { canManageSite, getAuthenticatedStaffAccount } from "../../../../../lib/staff-auth";

async function isSiteManagerAuthenticated() {
  if (await isSiteManageAuthenticated()) return true;
  const account = await getAuthenticatedStaffAccount();
  return canManageSite(account);
}

export async function PATCH(request, { params }) {
  if (!(await isSiteManagerAuthenticated())) {
    return NextResponse.json({ ok: false, message: "홈페이지 관리 권한이 필요합니다." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(body || {}, "status")) {
      payload.status = body.status === "hidden" ? "hidden" : "published";
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, "title")) {
      payload.title = String(body.title || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, "content")) {
      payload.content = String(body.content || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, "name")) {
      payload.name = String(body.name || "관리자 등록 사례").trim() || "관리자 등록 사례";
    }

    if (("name" in payload && !payload.name) || ("title" in payload && !payload.title) || ("content" in payload && !payload.content)) {
      return NextResponse.json({ ok: false, message: "고객이름과 내용을 입력해주세요." }, { status: 400 });
    }

    const updated = await supabaseRest(`/reviews?id=eq.${params.id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: payload,
    });
    return NextResponse.json({ ok: true, review: Array.isArray(updated) ? updated[0] : null });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "승인사례를 수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  if (!(await isSiteManagerAuthenticated())) {
    return NextResponse.json({ ok: false, message: "홈페이지 관리 권한이 필요합니다." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    await supabaseRest(`/reviews?id=eq.${params.id}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "승인사례를 삭제하지 못했습니다." }, { status: 500 });
  }
}
