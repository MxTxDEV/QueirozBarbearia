-- Corrige os e-mails de login de dois usuários criados pelo seed:
-- 1) O ADMIN da empresa real "Queiroz Barbearia" estava com o e-mail
--    genérico "admin@barberpro.com" — passa a ser "queiroz@barberpro.com",
--    liberando o genérico para o SUPERADMIN da plataforma.
-- 2) O SUPERADMIN estava com um typo no domínio ("baberpro.com", faltando
--    um "r") — passa a ser o e-mail correto "admin@barberpro.com".
-- Ordem importa: renomeia o admin da Queiroz primeiro para não colidir com
-- o e-mail único (unique) que o SUPERADMIN assume em seguida. Cada UPDATE
-- só toca a linha que ainda está com o e-mail antigo (idempotente, não
-- sobrescreve um e-mail já alterado manualmente por alguém depois disso).
UPDATE "users"
SET "email" = 'queiroz@barberpro.com'
WHERE "email" = 'admin@barberpro.com' AND "role" = 'ADMIN';

UPDATE "users"
SET "email" = 'admin@barberpro.com'
WHERE "email" = 'admin@baberpro.com' AND "role" = 'SUPERADMIN';
