# Barber Pro — Gestão de Barbearia (SaaS)

Sistema completo de gestão para barbearias: agendamento online com prevenção
de conflitos, portal do cliente, comunicação por WhatsApp, financeiro
(receitas, despesas, fluxo de caixa), metas e dashboard administrativo.

Identidade visual em **glassmorphism premium**, com paleta extraída da logo
Queiroz Barbearia (grafite/preto + vermelho, com dourado como acento).

## Stack

- **Frontend/Backend**: Next.js 16 (App Router), TypeScript, React 19
- **UI**: Tailwind CSS v4, componentes próprios (estilo shadcn/ui), Recharts
- **Dados**: PostgreSQL + Prisma ORM
- **Auth admin/barbeiro**: sessão via cookie httpOnly assinado (JWT/jose) + bcrypt
- **Auth cliente**: WhatsApp + código OTP (mock em desenvolvimento)
- **WhatsApp**: camada de abstração (`WhatsAppProvider`) com adapter mock
  para desenvolvimento e adapter para a Meta WhatsApp Cloud API — troque de
  fornecedor sem alterar o restante da aplicação
- **Validação**: Zod

## Rodando localmente

```bash
pnpm install
cp .env.example .env   # ajuste DATABASE_URL, AUTH_SECRET e (opcional) WhatsApp
pnpm exec prisma migrate dev
pnpm run db:seed       # cria admin, barbeiros Marcos/Arthur e serviços iniciais
pnpm run dev
```

Acesse `http://localhost:3000`:

- **Painel administrativo** (`/login`, empresa Queiroz Barbearia): `queiroz@barberpro.com` / `barberpro123`
- **SuperAdmin** (`/login`, plataforma): `admin@barberpro.com` / `barberpro123@`
- **Portal do cliente** (`/portal/login`): informe um WhatsApp; em
  desenvolvimento o código OTP é sempre `123456` (nenhuma mensagem real é
  enviada — veja a seção WhatsApp abaixo)

## Estrutura

```
prisma/schema.prisma        modelo de dados completo (usuários, clientes,
                             barbeiros, serviços, agendamentos com preço e
                             duração congelados, pagamentos, financeiro,
                             despesas recorrentes, metas, notificações,
                             mensagens de WhatsApp, audit log)
src/lib/whatsapp/           WhatsAppProvider (interface + mock + Cloud API)
                             e templates de mensagens
src/lib/availability.ts     motor de disponibilidade e prevenção de
                             conflitos de agenda (regras de negócio)
src/lib/data/                camada de leitura (por módulo)
src/actions/                 Server Actions (mutações, validadas com Zod)
src/app/(auth)/               login do painel administrativo
src/app/admin/                 painel: dashboard, agenda, clientes,
                                barbeiros, serviços, financeiro, metas,
                                relatórios, notificações, WhatsApp, config
src/app/portal/                 portal do cliente: login por WhatsApp+OTP,
                                 agendamento, meus horários, perfil
```

## Regras de negócio implementadas

1. Um barbeiro não pode ter dois agendamentos sobrepostos — verificado no
   servidor (com nova checagem dentro da transação) e refletido na
   disponibilidade mostrada ao cliente.
2. O horário ocupado considera a duração total dos serviços selecionados.
3. Preço e duração ficam **congelados** no momento do agendamento
   (`appointment_services`); alterações posteriores no catálogo não afetam
   agendamentos já criados.
4. Confirmar um agendamento **não** gera receita automaticamente — a
   receita só é lançada quando um pagamento é efetivamente registrado
   sobre um agendamento concluído.
5. Eventos críticos (criação, confirmação, cancelamento, pagamento) ficam
   registrados em `audit_logs`.
6. Clientes só acessam seus próprios dados (sessão isolada, escopada por
   `customerId`).

## Sobre a integração com WhatsApp

Em desenvolvimento, todas as mensagens usam o `MockWhatsAppProvider`
(apenas loga no console e registra em `whatsapp_messages`, visível em
`/admin/whatsapp`). Para produção, configure:

```
WHATSAPP_PROVIDER="cloud_api"
WHATSAPP_API_URL="..."
WHATSAPP_API_KEY="..."
WHATSAPP_PHONE_NUMBER_ID="..."
BARBERSHOP_WHATSAPP_NUMBER="+5531995797674"
```

Nenhuma credencial é exposta no frontend; tudo passa por Server Actions.
Para outro provedor (Twilio, Evolution API), implemente a interface
`WhatsAppProvider` em `src/lib/whatsapp/` e ajuste a fábrica em
`src/lib/whatsapp/index.ts`.
