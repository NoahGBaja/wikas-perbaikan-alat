-- Prisma cannot deserialize MariaDB zero dates into JavaScript Date values.
-- Repair legacy user rows before they are read by the user-management API.
UPDATE `User`
SET
  `createdAt` = CASE
    WHEN CAST(`createdAt` AS CHAR) LIKE '0000-00-00%' THEN NOW(3)
    ELSE `createdAt`
  END,
  `updatedAt` = CASE
    WHEN CAST(`updatedAt` AS CHAR) LIKE '0000-00-00%' THEN NOW(3)
    ELSE `updatedAt`
  END
WHERE CAST(`createdAt` AS CHAR) LIKE '0000-00-00%'
   OR CAST(`updatedAt` AS CHAR) LIKE '0000-00-00%';
