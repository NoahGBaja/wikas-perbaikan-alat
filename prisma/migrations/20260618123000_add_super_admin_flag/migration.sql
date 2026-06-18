ALTER TABLE `User`
ADD COLUMN `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false;

UPDATE `User`
SET `isSuperAdmin` = true,
    `role` = 'ADMIN_1',
    `categoryScope` = COALESCE(`categoryScope`, 'FASILITAS_INVENTARIS')
WHERE `role` = 'SUPER_ADMIN';
