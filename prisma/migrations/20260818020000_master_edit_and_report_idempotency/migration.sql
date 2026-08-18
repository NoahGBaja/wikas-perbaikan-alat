ALTER TABLE `Report`
  ADD COLUMN IF NOT EXISTS `idempotencyKey` VARCHAR(64) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS `Report_idempotencyKey_key` ON `Report`(`idempotencyKey`);
CREATE INDEX IF NOT EXISTS `Report_namaRuangan_idx` ON `Report`(`namaRuangan`);
CREATE INDEX IF NOT EXISTS `Report_nomorRuangan_idx` ON `Report`(`nomorRuangan`);
CREATE INDEX IF NOT EXISTS `Report_kategori_subcategory_idx` ON `Report`(`kategori`, `subcategory`);

INSERT INTO `MasterCategory` (`code`, `name`, `active`, `createdAt`, `updatedAt`)
VALUES
  ('FASILITAS_INVENTARIS', 'Fasilitas & Inventaris', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('IT_ELEKTRONIK', 'IT & Alat Elektronik', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('LABORATORIUM', 'Laboratorium', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `MasterRoom` (`code`, `name`, `active`, `createdAt`, `updatedAt`)
VALUES
  ('R-001', 'Ruang Kepala Balai', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('R-002', 'Ruang Tata Usaha', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('R-003', 'Ruang Rapat', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('R-004', 'Ruang Laboratorium', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('R-005', 'Ruang IT', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('R-006', 'Gudang Inventaris', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `updatedAt` = `updatedAt`;

INSERT INTO `MasterSubcategory` (`categoryId`, `code`, `name`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'INVENTARIS', 'Inventaris', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `MasterCategory` WHERE `code` = 'FASILITAS_INVENTARIS'
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `MasterSubcategory` (`categoryId`, `code`, `name`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'ELEKTRONIK', 'Elektronik', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `MasterCategory` WHERE `code` = 'FASILITAS_INVENTARIS'
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `MasterSubcategory` (`categoryId`, `code`, `name`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'KOMPUTER', 'Komputer', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `MasterCategory` WHERE `code` = 'IT_ELEKTRONIK'
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `MasterSubcategory` (`categoryId`, `code`, `name`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'PRINTER', 'Printer', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `MasterCategory` WHERE `code` = 'IT_ELEKTRONIK'
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `MasterSubcategory` (`categoryId`, `code`, `name`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'ALAT_LAB', 'Alat Lab', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `MasterCategory` WHERE `code` = 'LABORATORIUM'
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `MasterSubcategory` (`categoryId`, `code`, `name`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'PERLENGKAPAN', 'Perlengkapan', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `MasterCategory` WHERE `code` = 'LABORATORIUM'
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

INSERT INTO `MessageTemplate` (`type`, `title`, `body`, `active`, `createdAt`, `updatedAt`)
SELECT 'APPROVAL', 'Persetujuan', 'Laporan diterima dan dapat dilanjutkan ke tahap berikutnya.', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `MessageTemplate` WHERE `type` = 'APPROVAL' AND `title` = 'Persetujuan'
);

INSERT INTO `MessageTemplate` (`type`, `title`, `body`, `active`, `createdAt`, `updatedAt`)
SELECT 'REJECTION', 'Penolakan', 'Laporan ditolak karena data atau kondisi belum memenuhi persyaratan.', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `MessageTemplate` WHERE `type` = 'REJECTION' AND `title` = 'Penolakan'
);

INSERT INTO `MessageTemplate` (`type`, `title`, `body`, `active`, `createdAt`, `updatedAt`)
SELECT 'NOTES', 'Catatan', 'Mohon lengkapi informasi tambahan agar proses dapat dilanjutkan.', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `MessageTemplate` WHERE `type` = 'NOTES' AND `title` = 'Catatan'
);

INSERT INTO `MessageTemplate` (`type`, `title`, `body`, `active`, `createdAt`, `updatedAt`)
SELECT 'COMPLETION', 'Penyelesaian', 'Perbaikan telah selesai dilakukan. Mohon pelapor melakukan konfirmasi penerimaan barang.', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `MessageTemplate` WHERE `type` = 'COMPLETION' AND `title` = 'Penyelesaian'
);

DELETE older
FROM `MessageTemplate` older
INNER JOIN `MessageTemplate` newer
  ON older.`type` = newer.`type`
  AND older.`title` = newer.`title`
  AND older.`id` < newer.`id`;

CREATE UNIQUE INDEX IF NOT EXISTS `MessageTemplate_type_title_key`
  ON `MessageTemplate`(`type`, `title`);
