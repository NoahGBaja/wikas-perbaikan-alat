import "server-only";

import { prisma } from "@/src/lib/prisma";

let auditTableReady = false;

async function ensureAuditLogTable() {
  if (auditTableReady) return;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS AuditLog (
      id INT NOT NULL AUTO_INCREMENT,
      actorUserId INT NULL,
      reportId INT NULL,
      entityType VARCHAR(64) NOT NULL,
      entityId VARCHAR(191) NULL,
      action VARCHAR(64) NOT NULL,
      summary TEXT NOT NULL,
      metadata LONGTEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX AuditLog_actorUserId_idx (actorUserId),
      INDEX AuditLog_reportId_idx (reportId),
      INDEX AuditLog_entityType_action_idx (entityType, action),
      INDEX AuditLog_createdAt_idx (createdAt)
    )
  `;

  auditTableReady = true;
}

export async function recordAuditLog(input: {
  actorUserId?: number | null;
  reportId?: number | null;
  entityType: string;
  entityId?: string | number | null;
  action: string;
  summary: string;
  metadata?: unknown;
}) {
  try {
    await ensureAuditLogTable();

    await prisma.$executeRaw`
      INSERT INTO AuditLog
        (actorUserId, reportId, entityType, entityId, action, summary, metadata)
      VALUES
        (
          ${input.actorUserId ?? null},
          ${input.reportId ?? null},
          ${input.entityType},
          ${input.entityId === undefined || input.entityId === null ? null : String(input.entityId)},
          ${input.action},
          ${input.summary},
          ${input.metadata === undefined ? null : JSON.stringify(input.metadata)}
        )
    `;
  } catch (error) {
    console.error("AUDIT_LOG_ERROR:", error);
  }
}
