-- Zera os dados operacionais da plataforma: apaga todas as barbearias
-- (companies) e, em cascata, tudo que pertence a elas — usuários ADMIN/BARBER,
-- clientes, agendamentos, serviços, produtos, vendas/PDV, financeiro, metas,
-- notificações, mensagens de WhatsApp e configurações por empresa.
--
-- O que é MANTIDO de propósito:
--   - Contas SUPERADMIN (não têm company_id, não são afetadas pelo cascade)
--   - AuditLog: os registros ficam com company_id/user_id = NULL (ON DELETE
--     SET NULL) em vez de apagados, preservando o histórico de auditoria.
--     Se quiser apagar também o audit log, descomente a linha no final.
--
-- Uso:
--   PGPASSWORD=barberpro psql -h localhost -U barberpro -d barber_pro -f scripts/reset-platform-data.sql
--
-- Isso é IRREVERSÍVEL. Rode só depois de ter certeza do banco em que está
-- conectado (confira DATABASE_URL no .env antes de rodar em produção).

BEGIN;

DELETE FROM companies;

-- Descomente para também apagar o histórico de auditoria (por padrão ele
-- fica preservado, só com company_id/user_id nulos):
-- DELETE FROM audit_logs;

COMMIT;

-- Conferência pós-reset:
SELECT 'companies' AS tabela, count(*) FROM companies
UNION ALL SELECT 'users (deve sobrar só SUPERADMIN)', count(*) FROM users
UNION ALL SELECT 'users SUPERADMIN', count(*) FROM users WHERE role = 'SUPERADMIN'
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'appointments', count(*) FROM appointments
UNION ALL SELECT 'sales', count(*) FROM sales
UNION ALL SELECT 'audit_logs (preservados)', count(*) FROM audit_logs;
