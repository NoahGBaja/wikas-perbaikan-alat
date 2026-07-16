import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  revokeAuthToken,
} from "@/src/lib/auth";
import { validateMutationRequest } from "@/src/lib/request-security";

export async function POST(req: Request) {
  const requestError = validateMutationRequest(req);

  if (requestError) {
    return requestError;
  }

  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);

  if (token) {
    try {
      revokeAuthToken(decodeURIComponent(token));
    } catch {
      revokeAuthToken(token);
    }
  }

  const response = NextResponse.json({
    message: "Keluar berhasil.",
  });

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...getAuthCookieOptions(),
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
