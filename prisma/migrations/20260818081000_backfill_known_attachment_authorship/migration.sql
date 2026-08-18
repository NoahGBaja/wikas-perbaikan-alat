-- Backfill only references whose origin is unambiguous. Other legacy rows stay
-- null and are labelled honestly by the UI instead of guessing an uploader.
UPDATE `ReportAttachment` AS attachment
INNER JOIN `Report` AS report
  ON report.`id` = attachment.`reportId`
  AND report.`attachmentUrl` = attachment.`url`
SET
  attachment.`purpose` = 'DAMAGE_EVIDENCE',
  attachment.`uploadedByName` = COALESCE(report.`namaPelapor`, 'Pelapor'),
  attachment.`uploadedByRole` = 'USER'
WHERE attachment.`purpose` IS NULL;

UPDATE `ReportAttachment` AS attachment
INNER JOIN `Report` AS report
  ON report.`id` = attachment.`reportId`
  AND report.`completionPhotoUrl` = attachment.`url`
LEFT JOIN `ReportApprovalHistory` AS history
  ON history.`id` = (
    SELECT latest_history.`id`
    FROM `ReportApprovalHistory` AS latest_history
    WHERE latest_history.`reportId` = report.`id`
      AND latest_history.`toStatus` = 'MENUNGGU_KONFIRMASI'
    ORDER BY latest_history.`createdAt` DESC, latest_history.`id` DESC
    LIMIT 1
  )
LEFT JOIN `User` AS uploader
  ON uploader.`id` = history.`adminId`
SET
  attachment.`purpose` = 'COMPLETION_PROOF',
  attachment.`uploadedByName` = uploader.`nama`,
  attachment.`uploadedByRole` = uploader.`role`;
