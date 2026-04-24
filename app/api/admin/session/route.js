import { NextResponse } from "next/server";
import { getAdminAccessSession, getSiteManageAccessSession } from "../../../../lib/admin-auth";

export async function GET() {
  const adminAccess = await getAdminAccessSession();
  const siteAccess = adminAccess.authenticated ? adminAccess : await getSiteManageAccessSession();

  return NextResponse.json({
    ok: true,
    authenticated: Boolean(adminAccess.authenticated),
    siteManageAuthenticated: Boolean(siteAccess.authenticated),
    viewer: adminAccess.authenticated ? adminAccess : null,
    siteViewer: siteAccess.authenticated ? siteAccess : null,
  });
}
