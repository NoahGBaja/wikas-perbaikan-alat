import { randomUUID } from "crypto";
import {
  deleteStoredObject,
  putStoredObject,
} from "@/src/lib/file-storage";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REPORT_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_REPORT_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const IMAGE_EXTENSION_BY_TYPE = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

const REPORT_ATTACHMENT_EXTENSION_BY_TYPE = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function isUploadValidationError(
  error: unknown,
): error is UploadValidationError {
  return error instanceof UploadValidationError;
}

export function validateImageUpload(file: File | null, options?: { required?: boolean }) {
  if (!file || file.size === 0) {
    if (options?.required) {
      return "File gambar wajib diunggah.";
    }

    return null;
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Format gambar harus JPG, PNG, atau WEBP.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Ukuran gambar maksimal 5MB.";
  }

  return null;
}

export function validateReportAttachmentUpload(
  file: File | null,
  options?: { required?: boolean }
) {
  if (!file || file.size === 0) {
    if (options?.required) {
      return "Lampiran wajib diunggah.";
    }

    return null;
  }

  if (!ALLOWED_REPORT_ATTACHMENT_TYPES.has(file.type)) {
    return "Lampiran harus berupa JPG, PNG, WEBP, atau PDF.";
  }

  if (file.size > MAX_REPORT_ATTACHMENT_BYTES) {
    return "Lampiran maksimal 2MB.";
  }

  return null;
}

export function validateReportAttachmentUploads(
  files: File[],
  options?: { required?: boolean; maxFiles?: number },
) {
  if (options?.required && files.length === 0) {
    return "Lampiran wajib diunggah.";
  }

  const maxFiles = options?.maxFiles || 10;

  if (files.length > maxFiles) {
    return `Lampiran maksimal ${maxFiles} file.`;
  }

  for (const file of files) {
    const error = validateReportAttachmentUpload(file);

    if (error) {
      return `${file.name}: ${error}`;
    }
  }

  return null;
}

function isJpeg(bytes: Buffer) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Buffer) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isWebp(bytes: Buffer) {
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function hasValidImageSignature(bytes: Buffer, fileType: string) {
  if (fileType === "image/jpeg") return isJpeg(bytes);
  if (fileType === "image/png") return isPng(bytes);
  if (fileType === "image/webp") return isWebp(bytes);
  return false;
}

function isPdf(bytes: Buffer) {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

function hasValidReportAttachmentSignature(bytes: Buffer, fileType: string) {
  if (fileType === "application/pdf") return isPdf(bytes);
  return hasValidImageSignature(bytes, fileType);
}

export async function saveImageUpload(
  file: File,
  options?: {
    folder?: string;
  }
) {
  const validationError = validateImageUpload(file, { required: true });

  if (validationError) {
    throw new UploadValidationError(validationError);
  }

  const uploadFolder = options?.folder || "uploads";
  const bytes = Buffer.from(await file.arrayBuffer());

  if (!hasValidImageSignature(bytes, file.type)) {
    throw new UploadValidationError("Isi file gambar tidak valid.");
  }

  const extension =
    IMAGE_EXTENSION_BY_TYPE[file.type as keyof typeof IMAGE_EXTENSION_BY_TYPE];

  const finalFileName = `${Date.now()}-${randomUUID()}${extension}`;
  return putStoredObject({
    key: `${uploadFolder}/${finalFileName}`,
    bytes,
    contentType: file.type,
  });
}

export async function saveReportAttachmentUpload(
  file: File,
  options?: {
    folder?: string;
  }
) {
  const validationError = validateReportAttachmentUpload(file, {
    required: true,
  });

  if (validationError) {
    throw new UploadValidationError(validationError);
  }

  const uploadFolder = options?.folder || "uploads";

  const bytes = Buffer.from(await file.arrayBuffer());

  if (!hasValidReportAttachmentSignature(bytes, file.type)) {
    throw new UploadValidationError("Isi lampiran tidak valid.");
  }

  const extension =
    REPORT_ATTACHMENT_EXTENSION_BY_TYPE[
      file.type as keyof typeof REPORT_ATTACHMENT_EXTENSION_BY_TYPE
    ];

  const finalFileName = `${Date.now()}-${randomUUID()}${extension}`;
  return putStoredObject({
    key: `${uploadFolder}/${finalFileName}`,
    bytes,
    contentType: file.type,
  });
}

export async function deleteUploadedFileByUrl(fileUrl: string | null | undefined) {
  if (
    !fileUrl ||
    (!fileUrl.startsWith("/uploads/") &&
      !fileUrl.startsWith("private://uploads/"))
  ) {
    return;
  }

  await deleteStoredObject(fileUrl);
}
