import "server-only";

import path from "path";
import { promises as fs } from "fs";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const PRIVATE_REFERENCE_PREFIX = "private://";
const DEFAULT_LOCAL_STORAGE_ROOT = ".data/storage";

type StorageDriver = "local" | "s3";

export class StoredObjectNotFoundError extends Error {
  constructor() {
    super("Lampiran tidak ditemukan pada penyimpanan.");
    this.name = "StoredObjectNotFoundError";
  }
}

export function isStoredObjectNotFoundError(
  error: unknown,
): error is StoredObjectNotFoundError {
  return error instanceof StoredObjectNotFoundError;
}

function isStorageMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: string;
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return (
    candidate.code === "ENOENT" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function getStorageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER?.toLowerCase() === "s3" ? "s3" : "local";
}

function normalizeStorageKey(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");

  if (
    !normalized.startsWith("uploads/") ||
    normalized.includes("../") ||
    normalized.includes("\u0000")
  ) {
    throw new Error("Referensi lampiran tidak valid.");
  }

  return normalized;
}

export function createPrivateStorageReference(key: string) {
  return `${PRIVATE_REFERENCE_PREFIX}${normalizeStorageKey(key)}`;
}

export function getStorageKeyFromReference(reference: string) {
  if (reference.startsWith(PRIVATE_REFERENCE_PREFIX)) {
    return normalizeStorageKey(reference.slice(PRIVATE_REFERENCE_PREFIX.length));
  }

  if (reference.startsWith("/uploads/")) {
    return normalizeStorageKey(reference.slice(1));
  }

  throw new Error("Referensi lampiran tidak valid.");
}

function getLocalStorageRoot() {
  const configuredRoot = process.env.STORAGE_LOCAL_ROOT?.trim();
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    configuredRoot || DEFAULT_LOCAL_STORAGE_ROOT,
  );
}

function resolveLocalStoragePath(key: string) {
  const storageRoot = getLocalStorageRoot();
  const target = path.resolve(
    /* turbopackIgnore: true */ storageRoot,
    normalizeStorageKey(key),
  );

  if (!target.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Lokasi lampiran tidak valid.");
  }

  return target;
}

let s3Client: S3Client | null = null;

function getS3Config() {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";

  if (!bucket) {
    throw new Error("S3_BUCKET wajib diisi ketika STORAGE_DRIVER=s3.");
  }

  return { bucket, region };
}

function getS3Client() {
  if (s3Client) return s3Client;

  const { region } = getS3Config();
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  s3Client = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });

  return s3Client;
}

async function putLocalObject(key: string, bytes: Buffer) {
  const filePath = resolveLocalStoragePath(key);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(temporaryPath, bytes);
  await fs.rename(temporaryPath, filePath);
}

async function readLocalObject(key: string) {
  return fs.readFile(resolveLocalStoragePath(key));
}

async function readLegacyTruncatedLocalObject(
  key: string,
  reference: string,
) {
  // Versi lama memasukkan nama file asli ke key VARCHAR(191), sehingga
  // referensi dapat terpotong walaupun file fisiknya sudah tersimpan penuh.
  if (!reference.startsWith(PRIVATE_REFERENCE_PREFIX) || reference.length < 191) {
    throw new StoredObjectNotFoundError();
  }

  const truncatedPath = resolveLocalStoragePath(key);
  const directory = path.dirname(truncatedPath);
  const truncatedName = path.basename(truncatedPath);
  let entries: string[];

  try {
    entries = await fs.readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StoredObjectNotFoundError();
    }
    throw error;
  }

  const matches = entries.filter((entry) => entry.startsWith(truncatedName));

  if (matches.length !== 1) {
    throw new StoredObjectNotFoundError();
  }

  const recoveredPath = path.join(directory, matches[0]);

  try {
    await fs.rename(recoveredPath, truncatedPath);
  } catch (error) {
    // Proses paralel mungkin sudah memulihkan file yang sama lebih dulu.
    if (
      !isStorageMissingError(error) &&
      (error as NodeJS.ErrnoException).code !== "EEXIST"
    ) {
      throw error;
    }
  }

  try {
    return await fs.readFile(truncatedPath);
  } catch (error) {
    if (isStorageMissingError(error)) {
      throw new StoredObjectNotFoundError();
    }
    throw error;
  }
}

async function deleteLocalObject(key: string) {
  try {
    await fs.unlink(resolveLocalStoragePath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function putStoredObject(input: {
  key: string;
  bytes: Buffer;
  contentType: string;
}) {
  const key = normalizeStorageKey(input.key);

  if (getStorageDriver() === "s3") {
    const { bucket } = getS3Config();
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.bytes,
        ContentType: input.contentType,
        CacheControl: "private, max-age=300",
      }),
    );
  } else {
    await putLocalObject(key, input.bytes);
  }

  return createPrivateStorageReference(key);
}

async function readLegacyPublicObject(key: string) {
  const publicRoot = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicRoot, key);

  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Lokasi lampiran tidak valid.");
  }

  return fs.readFile(filePath);
}

export async function readStoredObject(reference: string) {
  const key = getStorageKeyFromReference(reference);

  if (getStorageDriver() === "s3") {
    try {
      const { bucket } = getS3Config();
      const response = await getS3Client().send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );

      if (!response.Body) throw new Error("Lampiran tidak ditemukan.");
      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error) {
      if (
        !reference.startsWith("/uploads/") &&
        isStorageMissingError(error)
      ) {
        throw new StoredObjectNotFoundError();
      }
      if (!reference.startsWith("/uploads/")) throw error;
    }
  } else {
    try {
      return await readLocalObject(key);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" &&
        reference.startsWith(PRIVATE_REFERENCE_PREFIX)
      ) {
        return readLegacyTruncatedLocalObject(key, reference);
      }

      if (
        !reference.startsWith("/uploads/") ||
        (error as NodeJS.ErrnoException).code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  try {
    return await readLegacyPublicObject(key);
  } catch (error) {
    if (isStorageMissingError(error)) {
      throw new StoredObjectNotFoundError();
    }
    throw error;
  }
}

export async function deleteStoredObject(reference: string) {
  const key = getStorageKeyFromReference(reference);

  if (getStorageDriver() === "s3") {
    const { bucket } = getS3Config();
    await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }

  await deleteLocalObject(key);

  if (reference.startsWith("/uploads/")) {
    try {
      const publicRoot = path.resolve(process.cwd(), "public");
      const legacyPath = path.resolve(publicRoot, key);

      if (legacyPath.startsWith(`${publicRoot}${path.sep}`)) {
        await fs.unlink(legacyPath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
