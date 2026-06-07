import { NextResponse, type NextRequest } from "next/server";
import type { AppRole } from "@/src/lib/roles";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/src/lib/auth";
import { isAdminRole } from "@/src/lib/roles";

function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

function getDefaultDashboard(role: AppRole) {
  return isAdminRole(role) ? "/dashboard/admin" : "/dashboard/user";
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const auth = getAuthPayload(request);

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password/");

  if (!auth) {
    if (isDashboardRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }

  const defaultDashboard = getDefaultDashboard(auth.role);

  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(defaultDashboard, request.url));
  }

  if (isAuthRoute) {
    return NextResponse.redirect(new URL(defaultDashboard, request.url));
  }

  if (pathname.startsWith("/dashboard/admin") && !isAdminRole(auth.role)) {
    return NextResponse.redirect(new URL("/dashboard/user", request.url));
  }

  if (pathname.startsWith("/dashboard/user") && auth.role !== "USER") {
    return NextResponse.redirect(new URL("/dashboard/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/forgot-password",
    "/reset-password/:path*",
    "/dashboard/:path*",
  ],
};