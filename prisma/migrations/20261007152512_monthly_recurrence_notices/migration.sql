-- CreateTable
CREATE TABLE "monthly_recurrence_notices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "monthly_recurrence_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_recurrence_notices_company_id_month_idx" ON "monthly_recurrence_notices"("company_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_recurrence_notices_customer_id_month_key" ON "monthly_recurrence_notices"("customer_id", "month");

-- AddForeignKey
ALTER TABLE "monthly_recurrence_notices" ADD CONSTRAINT "monthly_recurrence_notices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_recurrence_notices" ADD CONSTRAINT "monthly_recurrence_notices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
