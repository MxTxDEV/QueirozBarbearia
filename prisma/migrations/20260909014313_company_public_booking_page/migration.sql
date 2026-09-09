-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "cover_image_url" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "online_booking_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "companies_status_online_booking_enabled_idx" ON "companies"("status", "online_booking_enabled");
