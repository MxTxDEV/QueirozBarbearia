-- CreateTable
CREATE TABLE "whatsapp_automations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "template" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "offset_minutes" INTEGER,
    "send_time" TEXT,
    "day_of_month" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_automation_logs" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_automation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_automations_company_id_kind_idx" ON "whatsapp_automations"("company_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_automations_company_id_key_key" ON "whatsapp_automations"("company_id", "key");

-- CreateIndex
CREATE INDEX "whatsapp_automation_logs_automation_id_idx" ON "whatsapp_automation_logs"("automation_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_automation_logs_appointment_id_automation_id_start_key" ON "whatsapp_automation_logs"("appointment_id", "automation_id", "start_time");

-- AddForeignKey
ALTER TABLE "whatsapp_automations" ADD CONSTRAINT "whatsapp_automations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_automation_logs" ADD CONSTRAINT "whatsapp_automation_logs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_automation_logs" ADD CONSTRAINT "whatsapp_automation_logs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "whatsapp_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
