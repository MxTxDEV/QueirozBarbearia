-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_company_id_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "appointment_services_appointment_id_idx" ON "appointment_services"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_services_service_id_idx" ON "appointment_services"("service_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "barber_time_offs_barber_id_idx" ON "barber_time_offs"("barber_id");

-- CreateIndex
CREATE INDEX "financial_goals_barber_id_idx" ON "financial_goals"("barber_id");

-- CreateIndex
CREATE INDEX "financial_transactions_customer_id_idx" ON "financial_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "financial_transactions_appointment_id_idx" ON "financial_transactions"("appointment_id");

-- CreateIndex
CREATE INDEX "financial_transactions_expense_id_idx" ON "financial_transactions"("expense_id");

-- CreateIndex
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");

-- CreateIndex
CREATE INDEX "payments_appointment_id_idx" ON "payments"("appointment_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_customer_id_idx" ON "whatsapp_messages"("customer_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
