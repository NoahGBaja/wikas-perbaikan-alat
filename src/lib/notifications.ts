import { prisma } from "@/src/lib/prisma";
import type { AppCategoryScope, AppRole } from "@/src/lib/roles";
import { canAdminAccessReport } from "@/src/lib/workflow";

export async function notifyUsers(input: {
  userIds: number[];
  reportId?: number | null;
  title: string;
  message: string;
}) {
  const userIds = Array.from(new Set(input.userIds)).filter((id) => id > 0);

  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      reportId: input.reportId || null,
      title: input.title,
      message: input.message,
    })),
  });
}

export async function findWorkflowRecipientIds(input: {
  role?: AppRole | null;
  reportCategory: AppCategoryScope;
}) {
  if (!input.role) return [];

  const users = await prisma.user.findMany({
    where: {
      role: input.role,
    },
    select: {
      id: true,
      role: true,
      isSuperAdmin: true,
      categoryScope: true,
    },
  });

  return users
    .filter((user) =>
      canAdminAccessReport({
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        categoryScope: user.categoryScope,
        reportCategory: input.reportCategory,
      }),
    )
    .map((user) => user.id);
}
