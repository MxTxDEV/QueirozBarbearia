-- Recorrência com datas escolhidas à mão (sem intervalo fixo).
ALTER TABLE "recurring_appointments" ADD COLUMN "manual_dates" BOOLEAN NOT NULL DEFAULT false;

-- Limpeza: ocorrências de recorrência que, ao dar conflito, entravam SOZINHAS na lista de espera do cliente.
-- O cliente nunca pediu isso e recebia mensagem de "vaga disponível" sem ter horário marcado. Cancela essas
-- entradas (que ainda não viraram agendamento) e volta a ocorrência para "conflito", para a barbearia resolver.
UPDATE "waitlist_entries"
SET "status" = 'CANCELLED'
WHERE "status" IN ('WAITING', 'OFFERED')
  AND "id" IN (SELECT "waitlist_entry_id" FROM "recurring_appointment_occurrences" WHERE "waitlist_entry_id" IS NOT NULL);

UPDATE "recurring_appointment_occurrences"
SET "status" = 'CONFLICT'
WHERE "status" = 'WAITING_LIST';
