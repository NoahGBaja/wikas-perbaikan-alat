CREATE TABLE IF NOT EXISTS `ReportApprovalHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reportId` INTEGER NOT NULL,
    `adminId` INTEGER NOT NULL,
    `action` ENUM('ACC', 'TOLAK') NOT NULL,
    `fromStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'DITOLAK') NOT NULL,
    `toStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'DITOLAK') NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReportApprovalHistory_reportId_idx`(`reportId`),
    INDEX `ReportApprovalHistory_adminId_idx`(`adminId`),
    INDEX `ReportApprovalHistory_reportId_createdAt_idx`(`reportId`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ReportApprovalHistory_reportId_fkey`
      FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ReportApprovalHistory_adminId_fkey`
      FOREIGN KEY (`adminId`) REFERENCES `User`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
