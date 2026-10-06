-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "walk_in_name" TEXT,
ALTER COLUMN "customer_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "customer_id" DROP NOT NULL;
