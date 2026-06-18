ALTER TABLE `User`
MODIFY `role` ENUM(
  'ADMIN',
  'SUPER_ADMIN',
  'ADMIN_1',
  'ADMIN_2',
  'ADMIN_3',
  'ADMIN_4',
  'ADMIN_5',
  'ADMIN_6',
  'USER'
) NOT NULL DEFAULT 'USER';

UPDATE `User`
SET `role` = 'ADMIN_1'
WHERE `role` = 'ADMIN';

UPDATE `User`
SET `role` = 'ADMIN_5'
WHERE `role` = 'ADMIN_6';

ALTER TABLE `User`
MODIFY `role` ENUM(
  'SUPER_ADMIN',
  'ADMIN_1',
  'ADMIN_2',
  'ADMIN_3',
  'ADMIN_4',
  'ADMIN_5',
  'USER'
) NOT NULL DEFAULT 'USER';
