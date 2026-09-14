import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/lib/auth/customer-session-token";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { STORE_CONTEXT_COOKIE } from "@/lib/auth/store-context";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const customerSession = decodeCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  const response = NextResponse.next();
  response.headers.set("x-kubhai-pathname", pathname);

  // Remember store context from storefront URL (not from query businessId).
  const storeMatch = pathname.match(/^\/s\/([a-z0-9-]+)/i);
  if (storeMatch?.[1]) {
    response.cookies.set(STORE_CONTEXT_COOKIE, storeMatch[1], {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  if (pathname.startsWith("/store")) {
    // Store Admin login is public — do not mix with authenticated /store shell.
    if (pathname === "/store/login" || pathname.startsWith("/store/login/")) {
      return response;
    }
    if (!session) {
      return NextResponse.redirect(new URL("/store/login?next=/store", request.url));
    }
    if (session.role === "CUSTOMER") {
      return NextResponse.redirect(new URL("/account", request.url));
    }
    if (session.role === "SUPER_ADMIN") {
      return response;
    }
    if (
      session.role !== "BUSINESS_OWNER" &&
      session.role !== "BUSINESS_STAFF"
    ) {
      return NextResponse.redirect(new URL("/store/login", request.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/store/login?next=/admin", request.url));
    }
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/store", request.url));
    }
  }

  if (
    pathname.startsWith("/account") &&
    !pathname.startsWith("/account/login") &&
    !customerSession
  ) {
    const next = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/account/login?context=platform&next=${next}`, request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/store/:path*",
    "/admin/:path*",
    "/account",
    "/account/:path*",
    "/s/:path*",
    "/invite/:path*",
  ],
};
