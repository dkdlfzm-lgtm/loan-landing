import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";

export async function GET() {
  return NextResponse.json({ ok: true, authenticated: await isAdminAuthenticated() });
}
