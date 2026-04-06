import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") || "";

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/manage") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/m") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/price-result") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (pathname !== "/") return NextResponse.next();

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(userAgent);
  if (!isMobile) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/m";
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!favicon.ico).*)"],
};
