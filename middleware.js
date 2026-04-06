import { NextResponse } from "next/server";

const MOBILE_REGEX = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/m") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/manage") ||
    pathname.startsWith("/manage-mobile") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/price-result") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = MOBILE_REGEX.test(userAgent);

  if (pathname === "/" && isMobile) {
    const url = request.nextUrl.clone();
    url.pathname = "/m";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
