import { NextResponse } from "next/server";
import { getAuthenticatedStaffAccount } from "../../../../lib/staff-auth";

export async function GET() {
  const account = await getAuthenticatedStaffAccount();
  return NextResponse.json({ ok: true, authenticated: Boolean(account), account });
}
