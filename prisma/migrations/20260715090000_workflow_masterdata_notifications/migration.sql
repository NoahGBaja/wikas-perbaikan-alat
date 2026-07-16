ALTER TABLE `User` ADD COLUMN `notifications_dummy` INTEGER NULL;
ALTER TABLE `User` DROP COLUMN `notifications_dummy`;

ALTER TABLE `User`
  MODIFY `role` ENUM(
    'SUPER_ADMIN',
    'ADMIN_1',
    'ADMIN_2',
    'ADMIN_3',
    'ADMIN_4',
    'ADMIN_5',
    'EXECUTIVE',
    'USER'
  ) NOT NULL DEFAULT 'USER';

ALTER TABLE `Report`
  ADD COLUMN `ticket` VARCHAR(191) NULL,
  ADD COLUMN `namaRuangan` VARCHAR(191) NULL,
  ADD COLUMN `nup` VARCHAR(191) NULL,
  ADD COLUMN `subcategory` VARCHAR(191) NULL,
  ADD COLUMN `itemType` VARCHAR(191) NULL,
  ADD COLUMN `repairCost` DECIMAL(14, 2) NULL,
  ADD COLUMN `reporterConfirmedAt` DATETIME(3) NULL,
  ADD COLUMN `reporterConfirmationStatus` VARCHAR(191) NULL;

ALTER TABLE `Report` ADD UNIQUE INDEX `Report_ticket_key`(`ticket`);
CREATE INDEX `Report_ticket_idx` ON `Report`(`ticket`);
CREATE INDEX `Report_kategori_createdAt_idx` ON `Report`(`kategori`, `createdAt`);

ALTER TABLE `Report`
  MODIFY `status` ENUM(
    'MENUNGGU_ADMIN_1',
    'MENUNGGU_ADMIN_2',
    'MENUNGGU_ADMIN_3',
    'MENUNGGU_ADMIN_4',
    'MENUNGGU_ADMIN_5',
    'DISETUJUI_FINAL',
    'MENUNGGU_KONFIRMASI',
    'TELAH_BERFUNGSI',
    'TIDAK_DAPAT_DIGUNAKAN',
    'DITOLAK'
  ) NOT NULL DEFAULT 'MENUNGGU_ADMIN_1';

CREATE TABLE `ReportAttachment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reportId` INTEGER NOT NULL,
  `url` VARCHAR(191) NOT NULL,
  `fileType` VARCHAR(191) NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `fileSize` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ReportAttachment_reportId_idx` ON `ReportAttachment`(`reportId`);
ALTER TABLE `ReportAttachment` ADD CONSTRAINT `ReportAttachment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `MasterCategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MasterCategory_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MasterSubcategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `categoryId` INTEGER NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MasterSubcategory_categoryId_code_key`(`categoryId`, `code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MasterSubcategory` ADD CONSTRAINT `MasterSubcategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `MasterCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `MasterItemType` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `subcategoryId` INTEGER NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MasterItemType_subcategoryId_code_key`(`subcategoryId`, `code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MasterItemType` ADD CONSTRAINT `MasterItemType_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `MasterSubcategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `MasterRoom` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MasterRoom_code_key`(`code`),
  UNIQUE INDEX `MasterRoom_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MessageTemplate` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `MessageTemplate_type_active_idx` ON `MessageTemplate`(`type`, `active`);

CREATE TABLE `Notification` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `reportId` INTEGER NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Notification_userId_readAt_createdAt_idx` ON `Notification`(`userId`, `readAt`, `createdAt`);
CREATE INDEX `Notification_reportId_idx` ON `Notification`(`reportId`);
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
