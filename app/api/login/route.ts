import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createAuthSessionTag,
  getAuthCookieOptions,
  signAuthToken,
} from "@/src/lib/auth";
import { verifyPassword } from "@/src/lib/passwords";
import { getDefaultRedirectForUser } from "@/src/lib/session";
import { findUserByNipRaw } from "@/src/lib/raw-data";
import {
  clearRateLimit,
  getClientIp,
  isRateLimited,
} from "@/src/lib/rate-limit";
import { validateMutationRequest } from "@/src/lib/request-security";

async function parseLoginBody(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await req.formData();

    return {
      nip: typeof formData.get("nip") === "string" ? String(formData.get("nip")).trim() : "",
      password:
        typeof formData.get("password") === "string"
          ? String(formData.get("password"))
          : "",
      isFormPost: true,
    };
  }

  const body = await req.json();

  return {
    nip: typeof body.nip === "string" ? body.nip.trim() : "",
    password: typeof body.password === "string" ? body.password : "",
    isFormPost: false,
  };
}

function redirectLoginError(req: Request) {
  return NextResponse.redirect(new URL("/login?error=1", req.url), 303);
}

export async function POST(req: Request) {
  try {
    const requestError = validateMutationRequest(req, { body: "json" });

    if (requestError) {
      return requestError;
    }

    const { nip, password, isFormPost } = await parseLoginBody(req);

    if (!nip || !password) {
      if (isFormPost) {
        return redirectLoginError(req);
      }

      return NextResponse.json(
        { message: "NIP dan password wajib diisi." },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);
    const ipLimitKey = `login:ip:${clientIp}`;
    const nipLimitKey = `login:nip:${nip.toLowerCase()}`;

    const [ipLimited, nipLimited] = await Promise.all([
      isRateLimited(ipLimitKey, { limit: 30, windowMs: 15 * 60 * 1000 }),
      isRateLimited(nipLimitKey, { limit: 8, windowMs: 15 * 60 * 1000 }),
    ]);

    if (ipLimited || nipLimited) {
      if (isFormPost) {
        return redirectLoginError(req);
      }

      return NextResponse.json(
        { message: "Terlalu banyak percobaan login. Coba lagi nanti." },
        { status: 429 }
      );
    }

    const user = await findUserByNipRaw(nip, true);

    if (!user || !user.passwordHash) {
      if (isFormPost) {
        return redirectLoginError(req);
      }

      return NextResponse.json(
        { message: "NIP atau password salah" },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);

    if (!isMatch) {
      if (isFormPost) {
        return redirectLoginError(req);
      }

      return NextResponse.json(
        { message: "NIP atau password salah" },
        { status: 401 }
      );
    }

    await Promise.all([
      clearRateLimit(nipLimitKey),
      clearRateLimit(ipLimitKey),
    ]);

    const token = signAuthToken({
      userId: user.id,
      nama: user.nama,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      sessionTag: createAuthSessionTag({
        passwordHash: user.passwordHash,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      }),
    });

    const redirectTo = getDefaultRedirectForUser(user);
    const response = isFormPost
      ? NextResponse.redirect(new URL(redirectTo, req.url), 303)
      : NextResponse.json({
          message: "Masuk berhasil",
          user: {
            id: user.id,
            nama: user.nama,
            nip: user.nip,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin,
          },
          redirectTo,
        });

    response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    return response;
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return NextResponse.json(
      {
        message: "Terjadi kesalahan pada server",
        ...(process.env.NODE_ENV !== "production"
          ? {
              detail:
                error instanceof Error ? error.message : String(error),
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
