import "server-only";

import { prisma } from "@/src/lib/prisma";
import { getCategoryTicketCode } from "@/src/lib/master-data";
import type { AppCategoryScope } from "@/src/lib/roles";

export async function createTicket(category: AppCategoryScope, date = new Date()) {
  const year = date.getFullYear();
  const code = getCategoryTicketCode(category);
  const prefix = `LP-${year}-${code}-`;
  const sequence = await prisma.ticketSequence.upsert({
    where: { key: `${year}:${category}` },
    create: {
      key: `${year}:${category}`,
      currentValue: 1,
    },
    update: {
      currentValue: { increment: 1 },
    },
    select: { currentValue: true },
  });

  return `${prefix}${String(sequence.currentValue).padStart(4, "0")}`;
}
