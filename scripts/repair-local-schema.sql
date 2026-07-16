ALTER TABLE `User` ADD COLUMN IF NOT EXISTS `activeNip` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN IF NOT EXISTS `deletedAt` DATETIME(3) NULL;
ALTER TABLE `User` ADD COLUMN IF NOT EXISTS `categoryScope` ENUM('FASILITAS_INVENTARIS', 'IT_ELEKTRONIK', 'LABORATORIUM') NULL;
ALTER TABLE `User` ADD COLUMN IF NOT EXISTS `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false;

UPDATE `User`
SET `role` = 'ADMIN_1'
WHERE `role` = 'ADMIN';

UPDATE `User`
SET `role` = 'ADMIN_5'
WHERE `role` = 'ADMIN_6';

UPDATE `User`
SET `role` = 'ADMIN_1',
    `categoryScope` = COALESCE(`categoryScope`, 'FASILITAS_INVENTARIS')
WHERE `role` = '';

UPDATE `User`
SET `isSuperAdmin` = true,
    `role` = 'ADMIN_1',
    `categoryScope` = COALESCE(`categoryScope`, 'FASILITAS_INVENTARIS')
WHERE `role` = 'SUPER_ADMIN';

UPDATE `User`
SET `activeNip` = `nip`
WHERE `deletedAt` IS NULL
  AND `nip` IS NOT NULL
  AND `activeNip` IS NULL;

ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN_1', 'ADMIN_2', 'ADMIN_3', 'ADMIN_4', 'ADMIN_5', 'EXECUTIVE', 'USER') NOT NULL DEFAULT 'USER';

CREATE UNIQUE INDEX IF NOT EXISTS `User_activeNip_key` ON `User`(`activeNip`);

UPDATE `Report`
SET `status` = 'MENUNGGU_ADMIN_1'
WHERE `status` = '';

ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `namaPelapor` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `nomorRuangan` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `kodeUakpb` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `kode` VARCHAR(12) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `attachmentUrl` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `attachmentType` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `attachmentName` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `assignedTechnician` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `adminNotes` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `completionNotes` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `completionPhotoUrl` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `approvedAt` DATETIME(3) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `rejectedAt` DATETIME(3) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `processedAt` DATETIME(3) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `finishedAt` DATETIME(3) NULL;

UPDATE `Report`
SET
  `namaPelapor` = COALESCE(`namaPelapor`, ''),
  `nomorRuangan` = COALESCE(`nomorRuangan`, `lokasi`),
  `kodeUakpb` = COALESCE(`kodeUakpb`, ''),
  `kode` = COALESCE(`kode`, ''),
  `attachmentUrl` = COALESCE(`attachmentUrl`, `fotoUrl`),
  `attachmentType` = COALESCE(
    `attachmentType`,
    CASE
      WHEN `fotoUrl` IS NULL THEN NULL
      WHEN LOWER(`fotoUrl`) LIKE '%.jpg' OR LOWER(`fotoUrl`) LIKE '%.jpeg' THEN 'image/jpeg'
      WHEN LOWER(`fotoUrl`) LIKE '%.png' THEN 'image/png'
      WHEN LOWER(`fotoUrl`) LIKE '%.webp' THEN 'image/webp'
      ELSE NULL
    END
  );

CREATE TABLE IF NOT EXISTS `ReportApprovalHistory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reportId` INTEGER NOT NULL,
  `adminId` INTEGER NOT NULL,
  `action` ENUM('ACC', 'TOLAK') NOT NULL,
  `fromStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'MENUNGGU_KONFIRMASI', 'TELAH_BERFUNGSI', 'TIDAK_DAPAT_DIGUNAKAN', 'DITOLAK') NOT NULL,
  `toStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'MENUNGGU_KONFIRMASI', 'TELAH_BERFUNGSI', 'TIDAK_DAPAT_DIGUNAKAN', 'DITOLAK') NOT NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ReportApprovalHistory_reportId_idx`(`reportId`),
  INDEX `ReportApprovalHistory_adminId_idx`(`adminId`),
  INDEX `ReportApprovalHistory_reportId_createdAt_idx`(`reportId`, `createdAt`),
  CONSTRAINT `ReportApprovalHistory_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReportApprovalHistory_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

UPDATE `Report`
SET `status` = 'DISETUJUI_FINAL',
    `approvedAt` = COALESCE(`approvedAt`, NOW(3)),
    `finishedAt` = COALESCE(`finishedAt`, NOW(3))
WHERE `status` = 'MENUNGGU_ADMIN_6';

UPDATE `ReportApprovalHistory`
SET `fromStatus` = 'DISETUJUI_FINAL'
WHERE `fromStatus` = 'MENUNGGU_ADMIN_6';

UPDATE `ReportApprovalHistory`
SET `toStatus` = 'DISETUJUI_FINAL'
WHERE `toStatus` = 'MENUNGGU_ADMIN_6';

ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `ticket` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `namaRuangan` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `nup` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `subcategory` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `itemType` VARCHAR(191) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `repairCost` DECIMAL(14, 2) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `reporterConfirmed` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `reporterConfirmedAt` DATETIME(3) NULL;
ALTER TABLE `Report` ADD COLUMN IF NOT EXISTS `reporterConfirmationStatus` VARCHAR(191) NULL;

ALTER TABLE `Report` MODIFY `status` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'MENUNGGU_KONFIRMASI', 'TELAH_BERFUNGSI', 'TIDAK_DAPAT_DIGUNAKAN', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU_ADMIN_1';
ALTER TABLE `ReportApprovalHistory` MODIFY `fromStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'MENUNGGU_KONFIRMASI', 'TELAH_BERFUNGSI', 'TIDAK_DAPAT_DIGUNAKAN', 'DITOLAK') NOT NULL;
ALTER TABLE `ReportApprovalHistory` MODIFY `toStatus` ENUM('MENUNGGU_ADMIN_1', 'MENUNGGU_ADMIN_2', 'MENUNGGU_ADMIN_3', 'MENUNGGU_ADMIN_4', 'MENUNGGU_ADMIN_5', 'DISETUJUI_FINAL', 'MENUNGGU_KONFIRMASI', 'TELAH_BERFUNGSI', 'TIDAK_DAPAT_DIGUNAKAN', 'DITOLAK') NOT NULL;

UPDATE `Report`
SET `status` = 'MENUNGGU_ADMIN_1'
WHERE `status` = '';

CREATE UNIQUE INDEX IF NOT EXISTS `Report_ticket_key` ON `Report`(`ticket`);
CREATE INDEX IF NOT EXISTS `Report_ticket_idx` ON `Report`(`ticket`);
CREATE INDEX IF NOT EXISTS `Report_kategori_createdAt_idx` ON `Report`(`kategori`, `createdAt`);

CREATE TABLE IF NOT EXISTS `ReportAttachment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reportId` INTEGER NOT NULL,
  `url` VARCHAR(191) NOT NULL,
  `fileType` VARCHAR(191) NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `fileSize` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ReportAttachment_reportId_idx`(`reportId`),
  CONSTRAINT `ReportAttachment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `MasterCategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MasterCategory_code_key`(`code`),
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `MasterSubcategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `categoryId` INTEGER NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MasterSubcategory_categoryId_code_key`(`categoryId`, `code`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MasterSubcategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `MasterCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `MasterItemType` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `subcategoryId` INTEGER NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MasterItemType_subcategoryId_code_key`(`subcategoryId`, `code`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MasterItemType_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `MasterSubcategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS `MasterRoom` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MasterRoom_code_key`(`code`),
  UNIQUE INDEX `MasterRoom_name_key`(`name`),
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `MessageTemplate` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `MessageTemplate_type_active_idx`(`type`, `active`),
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `Notification` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `reportId` INTEGER NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
  INDEX `Notification_reportId_idx`(`reportId`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Notification_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE `Notification` ADD COLUMN IF NOT EXISTS `reportId` INTEGER NULL;
ALTER TABLE `Notification` ADD COLUMN IF NOT EXISTS `title` VARCHAR(191) NOT NULL DEFAULT 'Notifikasi';
ALTER TABLE `Notification` ADD COLUMN IF NOT EXISTS `message` TEXT NOT NULL;
ALTER TABLE `Notification` ADD COLUMN IF NOT EXISTS `readAt` DATETIME(3) NULL;
ALTER TABLE `Notification` ADD COLUMN IF NOT EXISTS `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS `Notification_userId_readAt_createdAt_idx` ON `Notification`(`userId`, `readAt`, `createdAt`);
CREATE INDEX IF NOT EXISTS `Notification_reportId_idx` ON `Notification`(`reportId`);

CREATE TABLE IF NOT EXISTS `RateLimitBucket` (
  `key` VARCHAR(191) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 1,
  `resetAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
);
