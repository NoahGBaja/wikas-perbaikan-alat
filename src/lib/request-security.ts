import "server-only";

import { NextResponse } from "next/server";

const DEFAULT_JSON_MAX_BYTES = 128 * 1024;
const DEFAULT_MULTIPART_MAX_BYTES = 6 * 1024 * 1024;

function getAllowedOrigins(req: Request) {
  const requestOrigin = new URL(req.url).origin;
  const configuredOrigins = (process.env.APP_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([requestOrigin, ...configuredOrigins]);
}

export function requireSameOrigin(req: Request) {
  const allowedOrigins = getAllowedOrigins(req);
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  if (origin) {
    return allowedOrigins.has(origin)
      ? null
      : NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;

      return allowedOrigins.has(refererOrigin)
        ? null
        : NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    } catch {
      return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
    }
  }

  return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
}

export function enforceBodySize(req: Request, maxBytes: number) {
  const contentLength = req.headers.get("content-length");

  if (!contentLength) {
    return NextResponse.json(
      { message: "Header Content-Length wajib dikirim." },
      { status: 411 }
    );
  }

  const parsed = Number(contentLength);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > maxBytes) {
    return NextResponse.json(
      { message: "Ukuran request terlalu besar." },
      { status: 413 }
    );
  }

  return null;
}

export function enforceJsonBodySize(req: Request) {
  return enforceBodySize(req, DEFAULT_JSON_MAX_BYTES);
}

export function enforceMultipartBodySize(req: Request) {
  return enforceBodySize(req, DEFAULT_MULTIPART_MAX_BYTES);
}

export function validateMutationRequest(
  req: Request,
  options?: { body?: "json" | "multipart" }
) {
  const originError = requireSameOrigin(req);

  if (originError) {
    return originError;
  }

  if (options?.body === "json") {
    return enforceJsonBodySize(req);
  }

  if (options?.body === "multipart") {
    return enforceMultipartBodySize(req);
  }

  return null;
}
