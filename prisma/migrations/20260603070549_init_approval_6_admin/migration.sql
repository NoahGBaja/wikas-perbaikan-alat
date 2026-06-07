/*
  Warnings:

  - You are about to alter the column `status` on the `Report` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(3))` to `Enum(EnumId(6))`.
  - The values [ADMIN] on the enum `User_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Report` MODIFY `status` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'MENUNGGU_ADMIN_6', 'DISETUJUI_FINAL', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU_ADMIN_1';

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN_1', 'ADMIN_2', 'ADMIN_3', 'ADMIN_4', 'ADMIN_5', 'ADMIN_6', 'USER') NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE `ReportApprovalHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reportId` INTEGER NOT NULL,
    `adminId` INTEGER NOT NULL,
    `action` ENUM('ACC', 'TOLAK') NOT NULL,
    `fromStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'MENUNGGU_ADMIN_6', 'DISETUJUI_FINAL', 'DITOLAK') NOT NULL,
    `toStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'MENUNGGU_ADMIN_6', 'DISETUJUI_FINAL', 'DITOLAK') NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReportApprovalHistory_reportId_idx`(`reportId`),
    INDEX `ReportApprovalHistory_adminId_idx`(`adminId`),
    INDEX `ReportApprovalHistory_reportId_createdAt_idx`(`reportId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReportApprovalHistory` ADD CONSTRAINT `ReportApprovalHistory_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportApprovalHistory` ADD CONSTRAINT `ReportApprovalHistory_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
