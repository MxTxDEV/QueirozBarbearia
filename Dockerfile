# syntax=docker/dockerfile:1

# Debian (glibc), não Alpine — evita divergência entre o engine do Prisma
# baixado em build (sem binaryTargets explícito no schema, ele detecta a
# plataforma do estágio que roda `prisma generate`) e a plataforma do
# estágio final. As três fases usam a mesma base por isso.
FROM node:20-bookworm-slim AS base
RUN corepack enable

# ---------------------------------------------------------------------------
# deps — instala as dependências a partir do lockfile, em camada própria
# pra não reinstalar tudo a cada mudança de código-fonte.
# ---------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder — gera o Prisma Client, aplica as migrations e builda o Next.
#
# `pnpm build` (ver package.json) roda `prisma generate && prisma migrate
# deploy && next build` numa tacada só — ou seja, a build PRECISA conseguir
# alcançar o banco de dados de produção nesta etapa, não só em runtime.
# No Coolify, DATABASE_URL/DIRECT_DATABASE_URL precisam estar configuradas
# como "Build Variables" (não só como variáveis de runtime do serviço),
# senão a build falha na hora do `prisma migrate deploy`.
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG DATABASE_URL
ARG DIRECT_DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_DATABASE_URL=${DIRECT_DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---------------------------------------------------------------------------
# runner — imagem final: só o server standalone + estáticos, sem
# devDependencies nem o restante do node_modules de build.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Uploads (logo/capa enviados pelos admins de cada empresa, ver
# src/lib/uploads.ts) precisam sobreviver a um novo deploy — monte um
# volume persistente apontando pra este caminho no Coolify. Sem isso, os
# arquivos enviados somem toda vez que a imagem é recriada.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
