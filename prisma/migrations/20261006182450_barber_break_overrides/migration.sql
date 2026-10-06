-- CreateTable
CREATE TABLE "barber_break_overrides" (
    "id" TEXT NOT NULL,
    "barber_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "break_start" TEXT,
    "break_end" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barber_break_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barber_break_overrides_barber_id_date_key" ON "barber_break_overrides"("barber_id", "date");

-- AddForeignKey
ALTER TABLE "barber_break_overrides" ADD CONSTRAINT "barber_break_overrides_barber_id_fkey" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
