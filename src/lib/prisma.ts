import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * O Prisma abre por padrão só (nº de CPUs × 2 + 1) conexões — num servidor pequeno são 3. Páginas que rodam
 * várias consultas em paralelo, mais o agendador embutido e as ações em segundo plano, ficavam esperando conexão
 * livre (sensação de "delay"). Sobe o limite, a menos que a DATABASE_URL já defina o seu.
 */
function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) parsed.searchParams.set("connection_limit", process.env.DB_POOL_SIZE ?? "15");
    if (!parsed.searchParams.has("pool_timeout")) parsed.searchParams.set("pool_timeout", "20");
    return parsed.toString();
  } catch {
    return url;
  }
}

const url = databaseUrl();
export const prisma = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
