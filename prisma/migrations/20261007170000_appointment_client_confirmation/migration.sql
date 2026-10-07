-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "client_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirm_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "appointments_confirm_token_key" ON "appointments"("confirm_token");

