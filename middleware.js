import { NextResponse, userAgent } from "next/server";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname !== "/") {
    return NextResponse.next();
  }

  const { device } = userAgent(request);
  const isMobile = device?.type === "mobile" || device?.type === "tablet";

  if (!isMobile) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/m";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/"],
};
