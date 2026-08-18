-- Keep the original failed report as an immutable audit record and link any
-- explicitly resubmitted report back to it.
ALTER TABLE `Report`
  ADD COLUMN `resubmittedFromId` INTEGER NULL;

CREATE INDEX `Report_resubmittedFromId_idx`
  ON `Report`(`resubmittedFromId`);

ALTER TABLE `Report`
  ADD CONSTRAINT `Report_resubmittedFromId_fkey`
  FOREIGN KEY (`resubmittedFromId`) REFERENCES `Report`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Authorship is snapshotted so attachment history remains meaningful even if
-- a user is renamed or later deactivated.
ALTER TABLE `ReportAttachment`
  ADD COLUMN `purpose` ENUM('DAMAGE_EVIDENCE', 'COMPLETION_PROOF') NULL,
  ADD COLUMN `uploadedByName` VARCHAR(191) NULL,
  ADD COLUMN `uploadedByRole` ENUM(
    'SUPER_ADMIN',
    'ADMIN_1',
    'ADMIN_2',
    'ADMIN_3',
    'ADMIN_4',
    'ADMIN_5',
    'EXECUTIVE',
    'USER'
  ) NULL;
