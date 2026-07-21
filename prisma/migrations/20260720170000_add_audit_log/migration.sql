CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `actorUserId` INTEGER NULL,
  `reportId` INTEGER NULL,
  `entityType` VARCHAR(191) NOT NULL,
  `entityId` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `summary` TEXT NOT NULL,
  `metadata` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `AuditLog_actorUserId_idx`(`actorUserId`),
  INDEX `AuditLog_reportId_idx`(`reportId`),
  INDEX `AuditLog_entityType_action_idx`(`entityType`, `action`),
  INDEX `AuditLog_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
