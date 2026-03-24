import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, createAdminToken, getAdminCookieOptions, isAdminPasswordValid, requireAdminConfigured } from "../../../../lib/admin-auth";

export async function POST(request) {
  try {
    requireAdminConfigured();
    const { password } = await request.json();
    if (!isAdminPasswordValid(password)) {
      return NextResponse.json({ ok: false, message: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE_NAME, createAdminToken(), getAdminCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "로그인에 실패했습니다." }, { status: 500 });
  }
}
