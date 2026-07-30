/*
  Warnings:

  - You are about to drop the `ratelimitbucket` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `report` DROP FOREIGN KEY `Report_userId_fkey`;

-- AlterTable
ALTER TABLE `report` ADD COLUMN `reporterConfirmed` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `kode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `reportapprovalhistory` MODIFY `fromStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'MENUNGGU_KONFIRMASI', 'TELAH_BERFUNGSI', 'TIDAK_DAPAT_DIGUNAKAN', 'DITOLAK') NOT NULL,
    MODIFY `toStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'MENUNGGU_KONFIRMASI', 'TELAH_BERFUNGSI', 'TIDAK_DAPAT_DIGUNAKAN', 'DITOLAK') NOT NULL;

-- DropTable
DROP TABLE `ratelimitbucket`;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
