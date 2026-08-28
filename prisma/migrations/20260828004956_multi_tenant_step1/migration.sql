-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- DropIndex
DROP INDEX "customers_whatsapp_key";

-- DropIndex
DROP INDEX "expenses_status_due_date_idx";

-- DropIndex
DROP INDEX "financial_transactions_type_transaction_date_idx";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "barbers" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "financial_goals" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "company_id" TEXT;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade_name" TEXT,
    "slug" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "logo_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);


-- Backfill: cria a empresa padrão representando os dados já existentes
-- (Queiroz Barbearia) e associa todos os registros atuais a ela.
INSERT INTO "companies" ("id", "name", "trade_name", "slug", "whatsapp", "status", "plan", "created_at", "updated_at")
VALUES ('company_default', 'Queiroz Barbearia', 'Queiroz Barbearia', 'queiroz-barbearia', '+5531995797674', 'ACTIVE', 'FREE', now(), now());

UPDATE "users" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "customers" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "barbers" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "services" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "appointments" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "payments" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "financial_transactions" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "expenses" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "financial_goals" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "notifications" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "whatsapp_messages" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "audit_logs" SET "company_id" = 'company_default' WHERE "company_id" IS NULL;
UPDATE "system_settings" SET "company_id" = 'company_default', "id" = 'legacy_' || "key" WHERE "company_id" IS NULL;


-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "appointments_company_id_idx" ON "appointments"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");

-- CreateIndex
CREATE INDEX "barbers_company_id_idx" ON "barbers"("company_id");

-- CreateIndex
CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_whatsapp_key" ON "customers"("company_id", "whatsapp");

-- CreateIndex
CREATE INDEX "expenses_company_id_status_due_date_idx" ON "expenses"("company_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "financial_goals_company_id_idx" ON "financial_goals"("company_id");

-- CreateIndex
CREATE INDEX "financial_transactions_company_id_type_transaction_date_idx" ON "financial_transactions"("company_id", "type", "transaction_date");

-- CreateIndex
CREATE INDEX "notifications_company_id_read_idx" ON "notifications"("company_id", "read");

-- CreateIndex
CREATE INDEX "payments_company_id_idx" ON "payments"("company_id");

-- CreateIndex
CREATE INDEX "services_company_id_idx" ON "services"("company_id");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_company_id_idx" ON "whatsapp_messages"("company_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barbers" ADD CONSTRAINT "barbers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

