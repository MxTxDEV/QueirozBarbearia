-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "review_request_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "review_link_url" TEXT;
