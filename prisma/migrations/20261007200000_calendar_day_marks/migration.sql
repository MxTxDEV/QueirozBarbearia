-- CreateTable
CREATE TABLE "calendar_day_marks" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "barber_id" TEXT,
    "title" TEXT,
    "start_time" TEXT,
    "end_time" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_day_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_day_marks_company_id_date_idx" ON "calendar_day_marks"("company_id", "date");

-- CreateIndex
CREATE INDEX "calendar_day_marks_barber_id_date_idx" ON "calendar_day_marks"("barber_id", "date");

-- AddForeignKey
ALTER TABLE "calendar_day_marks" ADD CONSTRAINT "calendar_day_marks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_day_marks" ADD CONSTRAINT "calendar_day_marks_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

