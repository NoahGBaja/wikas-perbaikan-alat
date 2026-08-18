import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  verifyAuthToken,
} from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
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
    let decodedToken = token;

    try {
      decodedToken = decodeURIComponent(token);
    } catch {
      // Nilai cookie yang tidak dapat didekode akan dianggap token tidak valid.
    }

    const payload = verifyAuthToken(decodedToken);
    if (payload) {
      await prisma.user.updateMany({
        where: { id: payload.userId, deletedAt: null },
        data: { sessionVersion: { increment: 1 } },
      });
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
