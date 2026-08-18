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

function getDefaultDashboard(auth: { role: AppRole; isSuperAdmin?: boolean }) {
  if (auth.role === "EXECUTIVE") {
    return "/dashboard/admin/statistik";
  }

  return auth.isSuperAdmin || isAdminRole(auth.role)
    ? "/dashboard/admin"
    : "/dashboard/user";
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/uploads/")) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const auth = getAuthPayload(request);
  const hasAuthCookie = request.cookies.has(AUTH_COOKIE_NAME);

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password/");

  if (isAuthRoute && request.nextUrl.searchParams.get("expired") === "1") {
    const response = NextResponse.next();
    response.cookies.delete(AUTH_COOKIE_NAME);

    return response;
  }

  if (!auth) {
    if (hasAuthCookie) {
      const response = isDashboardRoute
        ? NextResponse.redirect(new URL("/login?expired=1", request.url))
        : NextResponse.next();

      response.cookies.delete(AUTH_COOKIE_NAME);

      return response;
    }

    if (isDashboardRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }

  const defaultDashboard = getDefaultDashboard(auth);

  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(defaultDashboard, request.url));
  }

  if (isAuthRoute) {
    return NextResponse.redirect(new URL(defaultDashboard, request.url));
  }

  if (auth.role === "EXECUTIVE" && pathname === "/dashboard/admin") {
    return NextResponse.redirect(
      new URL("/dashboard/admin/statistik", request.url),
    );
  }

  if (
    pathname.startsWith("/dashboard/admin/statistik") &&
    auth.role !== "EXECUTIVE"
  ) {
    return NextResponse.redirect(new URL(defaultDashboard, request.url));
  }

  if (
    pathname.startsWith("/dashboard/admin/users") &&
    !auth.isSuperAdmin &&
    auth.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard/admin", request.url));
  }

  if (
    pathname.startsWith("/dashboard/admin") &&
    !auth.isSuperAdmin &&
    !isAdminRole(auth.role)
  ) {
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
    "/uploads/:path*",
  ],
};
