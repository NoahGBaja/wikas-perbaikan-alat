ALTER TABLE `Report`
  MODIFY `fotoUrl` VARCHAR(512) NULL,
  MODIFY `attachmentUrl` VARCHAR(512) NULL,
  MODIFY `attachmentName` VARCHAR(512) NULL,
  MODIFY `completionPhotoUrl` VARCHAR(512) NULL;

ALTER TABLE `ReportAttachment`
  MODIFY `url` VARCHAR(512) NOT NULL,
  MODIFY `fileName` VARCHAR(512) NOT NULL;
