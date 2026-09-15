-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WAITLIST_SLOT_OFFERED';

-- CreateTable
CREATE TABLE "barber_blocks" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "barber_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barber_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "barber_id" TEXT,
    "service_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "preferred_time" TIMESTAMP(3) NOT NULL,
    "tolerance_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "offered_barber_id" TEXT,
    "offered_start_time" TIMESTAMP(3),
    "offered_end_time" TIMESTAMP(3),
    "hold_expires_at" TIMESTAMP(3),
    "notified_at" TIMESTAMP(3),
    "confirmed_appointment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "barber_blocks_company_id_idx" ON "barber_blocks"("company_id");

-- CreateIndex
CREATE INDEX "barber_blocks_barber_id_date_idx" ON "barber_blocks"("barber_id", "date");

-- CreateIndex
CREATE INDEX "barber_blocks_barber_id_start_time_end_time_idx" ON "barber_blocks"("barber_id", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_confirmed_appointment_id_key" ON "waitlist_entries"("confirmed_appointment_id");

-- CreateIndex
CREATE INDEX "waitlist_entries_company_id_status_date_idx" ON "waitlist_entries"("company_id", "status", "date");

-- CreateIndex
CREATE INDEX "waitlist_entries_barber_id_status_idx" ON "waitlist_entries"("barber_id", "status");

-- CreateIndex
CREATE INDEX "waitlist_entries_hold_expires_at_idx" ON "waitlist_entries"("hold_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_company_id_customer_id_barber_id_service_i_key" ON "waitlist_entries"("company_id", "customer_id", "barber_id", "service_id", "date", "preferred_time");

-- AddForeignKey
ALTER TABLE "barber_blocks" ADD CONSTRAINT "barber_blocks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barber_blocks" ADD CONSTRAINT "barber_blocks_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barber_blocks" ADD CONSTRAINT "barber_blocks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_offered_barber_id_fkey" FOREIGN KEY ("offered_barber_id") REFERENCES "barbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_confirmed_appointment_id_fkey" FOREIGN KEY ("confirmed_appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
