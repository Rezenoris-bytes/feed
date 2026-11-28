-- CreateTable
CREATE TABLE `customer_forms` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `intro` VARCHAR(600) NOT NULL DEFAULT '',
    `thanks` VARCHAR(300) NOT NULL DEFAULT '',
    `fields` JSON NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customer_forms_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_form_sends` (
    `id` CHAR(36) NOT NULL,
    `formId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `tokenEnc` VARCHAR(255) NOT NULL,
    `customerName` VARCHAR(120) NOT NULL,
    `company` VARCHAR(120) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(32) NULL,
    `machine` VARCHAR(160) NULL,
    `sentById` CHAR(36) NULL,
    `emailedAt` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NULL,
    `respondedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_form_sends_tokenHash_key`(`tokenHash`),
    INDEX `customer_form_sends_formId_createdAt_idx`(`formId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_form_responses` (
    `id` CHAR(36) NOT NULL,
    `sendId` CHAR(36) NOT NULL,
    `fields` JSON NOT NULL,
    `answers` JSON NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_form_responses_sendId_key`(`sendId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_form_sends` ADD CONSTRAINT `customer_form_sends_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `customer_forms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_form_responses` ADD CONSTRAINT `customer_form_responses_sendId_fkey` FOREIGN KEY (`sendId`) REFERENCES `customer_form_sends`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

