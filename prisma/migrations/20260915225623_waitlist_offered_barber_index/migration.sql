-- CreateIndex
CREATE INDEX "waitlist_entries_offered_barber_id_status_idx" ON "waitlist_entries"("offered_barber_id", "status");
