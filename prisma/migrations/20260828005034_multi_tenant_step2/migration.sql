
-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "barbers" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "financial_goals" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "financial_transactions" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "services" ALTER COLUMN "company_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_pkey",
ALTER COLUMN "id" SET NOT NULL,
ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "whatsapp_messages" ALTER COLUMN "company_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_company_id_key_key" ON "system_settings"("company_id", "key");

