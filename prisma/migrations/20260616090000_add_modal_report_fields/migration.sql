ALTER TABLE `Report`
ADD COLUMN `namaPelapor` VARCHAR(191) NULL,
ADD COLUMN `nomorRuangan` VARCHAR(191) NULL,
ADD COLUMN `kodeUakpb` VARCHAR(191) NULL,
ADD COLUMN `kode` VARCHAR(12) NULL,
ADD COLUMN `attachmentUrl` VARCHAR(191) NULL,
ADD COLUMN `attachmentType` VARCHAR(191) NULL,
ADD COLUMN `attachmentName` VARCHAR(191) NULL;

UPDATE `Report`
SET
  `namaPelapor` = COALESCE(`namaPelapor`, ''),
  `nomorRuangan` = COALESCE(`nomorRuangan`, `lokasi`),
  `kodeUakpb` = COALESCE(`kodeUakpb`, ''),
  `kode` = COALESCE(`kode`, ''),
  `attachmentUrl` = COALESCE(`attachmentUrl`, `fotoUrl`),
  `attachmentType` = CASE
    WHEN `fotoUrl` IS NULL THEN NULL
    WHEN LOWER(`fotoUrl`) LIKE '%.jpg' OR LOWER(`fotoUrl`) LIKE '%.jpeg' THEN 'image/jpeg'
    WHEN LOWER(`fotoUrl`) LIKE '%.png' THEN 'image/png'
    WHEN LOWER(`fotoUrl`) LIKE '%.webp' THEN 'image/webp'
    ELSE NULL
  END;
