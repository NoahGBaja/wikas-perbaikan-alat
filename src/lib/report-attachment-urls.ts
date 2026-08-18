export function getReportAttachmentUrl(
  reportId: number,
  attachmentId: number | "legacy" | "completion",
  options?: { inline?: boolean },
) {
  const base = `/api/reports/${reportId}/attachments/${attachmentId}/download`;
  return options?.inline ? `${base}?disposition=inline` : base;
}

export function findAttachmentIdForReference(
  attachments: { id: number; url: string }[] | null | undefined,
  reference: string | null | undefined,
) {
  if (!reference) return null;
  return attachments?.find((attachment) => attachment.url === reference)?.id ?? null;
}

export function formatAttachmentPurpose(
  purpose: "DAMAGE_EVIDENCE" | "COMPLETION_PROOF" | null | undefined,
) {
  if (purpose === "DAMAGE_EVIDENCE") return "Bukti kerusakan";
  if (purpose === "COMPLETION_PROOF") return "Bukti penyelesaian";

  return "Lampiran lama";
}

export function formatAttachmentFileSize(bytes: number | null | undefined) {
  if (!Number.isFinite(bytes) || !bytes || bytes <= 0) return "Tidak tersedia";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type ReportWithAttachmentReferences = {
  id: number;
  idempotencyKey?: string | null;
  fotoUrl?: string | null;
  attachmentUrl?: string | null;
  completionPhotoUrl?: string | null;
  attachments?: Array<{
    id: number;
    url: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export function protectReportAttachmentReferences<
  T extends ReportWithAttachmentReferences,
>(report: T): Omit<T, "idempotencyKey"> {
  const originalAttachments = report.attachments || [];
  const publicReport = { ...report };
  delete publicReport.idempotencyKey;

  function protectedUrl(
    reference: string | null | undefined,
    fallback: "legacy" | "completion",
    inline = false,
  ) {
    if (!reference) return null;

    const attachmentId = findAttachmentIdForReference(
      originalAttachments,
      reference,
    );

    return getReportAttachmentUrl(
      report.id,
      attachmentId || fallback,
      inline ? { inline: true } : undefined,
    );
  }

  return {
    ...publicReport,
    ...(Object.hasOwn(report, "fotoUrl")
      ? { fotoUrl: protectedUrl(report.fotoUrl, "legacy", true) }
      : {}),
    ...(Object.hasOwn(report, "attachmentUrl")
      ? { attachmentUrl: protectedUrl(report.attachmentUrl, "legacy") }
      : {}),
    ...(Object.hasOwn(report, "completionPhotoUrl")
      ? {
          completionPhotoUrl: protectedUrl(
            report.completionPhotoUrl,
            "completion",
            true,
          ),
        }
      : {}),
    ...(report.attachments
      ? {
          attachments: originalAttachments.map((attachment) => ({
            ...attachment,
            url: getReportAttachmentUrl(report.id, attachment.id),
          })),
        }
      : {}),
  } as Omit<T, "idempotencyKey">;
}
