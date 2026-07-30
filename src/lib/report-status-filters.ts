export const IN_PROGRESS_STATUS_FILTER = "DALAM_PROSES" as const;

const IN_PROGRESS_STATUSES = new Set([
  "MENUNGGU_ADMIN_1",
  "MENUNGGU_ADMIN_2",
  "MENUNGGU_ADMIN_3",
  "MENUNGGU_ADMIN_4",
  "MENUNGGU_ADMIN_5",
  "MENUNGGU_KONFIRMASI",
]);

export function isInProgressStatus(status: string) {
  return IN_PROGRESS_STATUSES.has(status);
}
