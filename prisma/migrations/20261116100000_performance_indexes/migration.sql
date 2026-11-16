-- Índices para as consultas mais frequentes (sempre filtradas por empresa e ordenadas/limitadas por data).
CREATE INDEX IF NOT EXISTS "appointments_company_id_appointment_date_idx" ON "appointments" ("company_id", "appointment_date");
CREATE INDEX IF NOT EXISTS "notifications_company_id_created_at_idx" ON "notifications" ("company_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_messages_company_id_created_at_idx" ON "whatsapp_messages" ("company_id", "created_at");
