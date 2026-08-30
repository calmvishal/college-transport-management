import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * This is defense-in-depth for page routes (API routes independently
 * enforce roles via requireRole in lib/apiAuth.ts, which is the real
 * security boundary since middleware can be bypassed by calling the API
 * directly — but that call still hits requireRole and gets rejected).
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    if (pathname.startsWith("/student") && role !== "student") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/driver") && role !== "driver") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/incharge") && role !== "incharge") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/student/:path*", "/driver/:path*", "/incharge/:path*"],
};
