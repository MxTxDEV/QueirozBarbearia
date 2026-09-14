-- CreateIndex
CREATE INDEX "barber_services_service_id_idx" ON "barber_services"("service_id");

-- CreateIndex
CREATE INDEX "customer_otps_customer_id_idx" ON "customer_otps"("customer_id");

-- CreateIndex
CREATE INDEX "customer_sessions_customer_id_idx" ON "customer_sessions"("customer_id");

-- CreateIndex
CREATE INDEX "sale_items_service_id_idx" ON "sale_items"("service_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
