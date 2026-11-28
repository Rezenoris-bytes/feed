-- AlterTable
ALTER TABLE `customer_form_sends` ADD COLUMN `viaShare` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `customer_forms` ADD COLUMN `shareCode` VARCHAR(32) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `customer_forms_shareCode_key` ON `customer_forms`(`shareCode`);

