import "server-only";

import { prisma } from "@/src/lib/prisma";
import { getCategoryTicketCode } from "@/src/lib/master-data";
import type { AppCategoryScope } from "@/src/lib/roles";

export async function createTicket(category: AppCategoryScope, date = new Date()) {
  const year = date.getFullYear();
  const code = getCategoryTicketCode(category);
  const prefix = `LP-${year}-${code}-`;
  const count = await prisma.report.count({
    where: {
      ticket: {
        startsWith: prefix,
      },
    },
  });

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}
