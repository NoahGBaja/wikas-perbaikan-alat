INSERT INTO `TicketSequence` (`key`, `currentValue`, `updatedAt`)
SELECT
  CONCAT(YEAR(`createdAt`), ':', `kategori`) AS `key`,
  MAX(CAST(SUBSTRING_INDEX(`ticket`, '-', -1) AS UNSIGNED)) AS `currentValue`,
  CURRENT_TIMESTAMP(3) AS `updatedAt`
FROM `Report`
WHERE `ticket` REGEXP '^LP-[0-9]{4}-(INF|IT|LAB)-[0-9]+$'
GROUP BY YEAR(`createdAt`), `kategori`
ON DUPLICATE KEY UPDATE
  `currentValue` = GREATEST(
    `TicketSequence`.`currentValue`,
    VALUES(`currentValue`)
  ),
  `updatedAt` = VALUES(`updatedAt`);
