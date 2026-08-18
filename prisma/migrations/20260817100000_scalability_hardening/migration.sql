-- Restore active-NIP uniqueness for every non-deleted user.
UPDATE `User`
SET `activeNip` = `nip`
WHERE `deletedAt` IS NULL
  AND `nip` IS NOT NULL
  AND (`activeNip` IS NULL OR `activeNip` <> `nip`);

CREATE TABLE `TicketSequence` (
  `key` VARCHAR(191) NOT NULL,
  `currentValue` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
);

CREATE TABLE `RateLimitBucket` (
  `bucketKey` VARCHAR(191) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 1,
  `resetAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`bucketKey`),
  INDEX `RateLimitBucket_resetAt_idx`(`resetAt`)
);

CREATE INDEX `User_deletedAt_role_nama_idx`
ON `User`(`deletedAt`, `role`, `nama`);

CREATE INDEX `Report_kategori_status_createdAt_idx`
ON `Report`(`kategori`, `status`, `createdAt`);
