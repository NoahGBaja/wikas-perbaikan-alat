import { getCategoryTicketCode } from "@/src/lib/master-data";
import type { AppCategoryScope } from "@/src/lib/roles";

export function formatTicketFallback(report: {
  id: number;
  ticket?: string | null;
  kategori?: AppCategoryScope;
  createdAt?: Date | string;
}) {
  if (report.ticket) return report.ticket;

  const year = report.createdAt
    ? new Date(report.createdAt).getFullYear()
    : new Date().getFullYear();
  const code = report.kategori ? getCategoryTicketCode(report.kategori) : "INF";

  return `LP-${year}-${code}-${String(report.id).padStart(4, "0")}`;
}
