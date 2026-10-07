import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Endereço público do sistema (https://suabarbearia.com.br), usado nos links que vão por WhatsApp
 * (ex: confirmar o horário). Ordem: variável APP_URL (recomendado em produção) → o endereço da
 * requisição em andamento → o último endereço visto por uma rota de cron.
 */
let lastSeenOrigin: string | null = null;

export function rememberOrigin(origin: string | null | undefined) {
  if (origin && /^https?:\/\//.test(origin)) lastSeenOrigin = origin.replace(/\/+$/, "");
}

/** Origem a partir dos cabeçalhos de uma requisição (atrás de proxy: x-forwarded-*). */
export function originFromHeaders(get: (name: string) => string | null | undefined): string | null {
  const host = get("x-forwarded-host") ?? get("host");
  if (!host) return null;
  const proto = get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

export async function getAppBaseUrl(companyId?: string): Promise<string | null> {
  const fromEnv = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv.replace(/\/+$/, "");
  // O link de divulgação que a própria barbearia cadastrou já diz qual é o endereço público do sistema.
  if (companyId) {
    const setting = await prisma.systemSetting.findUnique({ where: { companyId_key: { companyId, key: "wa_booking_link" } }, select: { value: true } });
    try {
      if (setting?.value) return new URL(setting.value).origin;
    } catch {
      // link cadastrado inválido: ignora
    }
  }
  try {
    const h = await headers();
    const origin = originFromHeaders((name) => h.get(name));
    if (origin) return origin;
  } catch {
    // fora de uma requisição (cron/job): cai no último endereço visto
  }
  return lastSeenOrigin;
}
