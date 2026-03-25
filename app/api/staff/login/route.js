import { NextResponse } from "next/server";
import { STAFF_COOKIE_NAME, createStaffToken, getStaffCookieOptions, isStaffPasswordValid, requireStaffConfigured } from "../../../../lib/staff-auth";

export async function POST(request) {
  try {
    requireStaffConfigured();
    const { password } = await request.json();
    if (!isStaffPasswordValid(password)) return NextResponse.json({ ok: false, message: '직원 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(STAFF_COOKIE_NAME, createStaffToken(), getStaffCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || '로그인에 실패했습니다.' }, { status: 500 });
  }
}
