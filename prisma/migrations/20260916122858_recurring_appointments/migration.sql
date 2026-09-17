-- CreateEnum
CREATE TYPE "RecurringFrequencyUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS');

-- CreateEnum
CREATE TYPE "RecurringAppointmentStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RecurringOccurrenceStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CONFLICT', 'CANCELLED', 'SKIPPED', 'WAITING_LIST');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_OCCURRENCE_CONFLICT';

-- CreateTable
CREATE TABLE "recurring_appointments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "barber_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "frequency_unit" "RecurringFrequencyUnit" NOT NULL,
    "interval_value" INTEGER NOT NULL,
    "end_date" DATE,
    "occurrences_limit" INTEGER,
    "status" "RecurringAppointmentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "generated_until" DATE,
    "created_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "recurring_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_appointment_occurrences" (
    "id" TEXT NOT NULL,
    "recurring_appointment_id" TEXT NOT NULL,
    "occurrence_number" INTEGER NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "scheduled_start_time" TIMESTAMP(3) NOT NULL,
    "scheduled_end_time" TIMESTAMP(3) NOT NULL,
    "status" "RecurringOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "appointment_id" TEXT,
    "waitlist_entry_id" TEXT,
    "conflict_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_appointment_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_appointments_company_id_status_idx" ON "recurring_appointments"("company_id", "status");

-- CreateIndex
CREATE INDEX "recurring_appointments_barber_id_status_idx" ON "recurring_appointments"("barber_id", "status");

-- CreateIndex
CREATE INDEX "recurring_appointments_customer_id_idx" ON "recurring_appointments"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_appointment_occurrences_appointment_id_key" ON "recurring_appointment_occurrences"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_appointment_occurrences_waitlist_entry_id_key" ON "recurring_appointment_occurrences"("waitlist_entry_id");

-- CreateIndex
CREATE INDEX "recurring_appointment_occurrences_recurring_appointment_id__idx" ON "recurring_appointment_occurrences"("recurring_appointment_id", "status");

-- CreateIndex
CREATE INDEX "recurring_appointment_occurrences_scheduled_date_idx" ON "recurring_appointment_occurrences"("scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_appointment_occurrences_recurring_appointment_id__key" ON "recurring_appointment_occurrences"("recurring_appointment_id", "occurrence_number");

-- AddForeignKey
ALTER TABLE "recurring_appointments" ADD CONSTRAINT "recurring_appointments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_appointments" ADD CONSTRAINT "recurring_appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_appointments" ADD CONSTRAINT "recurring_appointments_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_appointments" ADD CONSTRAINT "recurring_appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_appointments" ADD CONSTRAINT "recurring_appointments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_appointments" ADD CONSTRAINT "recurring_appointments_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_appointment_occurrences" ADD CONSTRAINT "recurring_appointment_occurrences_recurring_appointment_id_fkey" FOREIGN KEY ("recurring_appointment_id") REFERENCES "recurring_appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_appointment_occurrences" ADD CONSTRAINT "recurring_appointment_occurrences_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_appointment_occurrences" ADD CONSTRAINT "recurring_appointment_occurrences_waitlist_entry_id_fkey" FOREIGN KEY ("waitlist_entry_id") REFERENCES "waitlist_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
