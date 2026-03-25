import { NextResponse } from "next/server";
import { STAFF_COOKIE_NAME } from "../../../../lib/staff-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
