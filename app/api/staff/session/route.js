import { NextResponse } from "next/server";
import { getStaffSession } from "../../../../lib/staff-auth";

export async function GET() {
  const session = await getStaffSession();
  return NextResponse.json({ ok: true, authenticated: Boolean(session), account: session });
}
