-- Link de divulgação da Queiroz Barbearia, enviado no rodapé das mensagens de WhatsApp.
-- Só afeta a empresa cujo slug é "queirozbarbearia" (em qualquer outro banco não faz nada) e nunca
-- sobrescreve um link que alguém já tenha cadastrado pela tela.
INSERT INTO "system_settings" ("id", "company_id", "key", "value", "updated_at")
SELECT 'wa-booking-link-' || "id", "id", 'wa_booking_link', 'https://icortes.idsystem.cloud/agendar/queirozbarbearia', NOW()
FROM "companies"
WHERE "slug" = 'queirozbarbearia'
ON CONFLICT ("company_id", "key") DO NOTHING;
