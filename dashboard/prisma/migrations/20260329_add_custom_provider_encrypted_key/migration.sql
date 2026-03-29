-- AlterTable: add nullable encrypted key column to custom_providers
ALTER TABLE "custom_providers" ADD COLUMN "apiKeyEncrypted" TEXT;
