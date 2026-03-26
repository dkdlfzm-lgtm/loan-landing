import { NextResponse } from "next/server";
import { STAFF_COOKIE_NAME, createStaffToken, findStaffAccountByCredentials, getStaffCookieOptions, requireStaffConfigured } from "../../../../lib/staff-auth";

export async function POST(request) {
  try {
    requireStaffConfigured();
    const { username, password } = await request.json();
    const account = await findStaffAccountByCredentials(username, password);

    if (!account) {
      return NextResponse.json({ ok: false, message: "직원 아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        username: account.username,
        display_name: account.display_name || account.username,
      },
    });
    response.cookies.set(STAFF_COOKIE_NAME, createStaffToken(account), getStaffCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "로그인에 실패했습니다." }, { status: 500 });
  }
}
