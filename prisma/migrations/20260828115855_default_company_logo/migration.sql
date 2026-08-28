-- Preenche a logo da empresa padrão (Queiroz Barbearia) com o arquivo já
-- hospedado publicamente, agora que companies.logo_url passa a ser
-- configurável por cada empresa em /admin/settings. Só toca a linha que
-- ainda está sem logo (idempotente e não sobrescreve uma escolha do
-- administrador feita depois deste deploy).
UPDATE "companies"
SET "logo_url" = '/logo-queiroz-transparent.png'
WHERE "slug" = 'queiroz-barbearia' AND "logo_url" IS NULL;
