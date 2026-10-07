import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/app-url";
import { DEFAULT_FOOTER_TEXT, applyFooter, templateFields } from "./automation-defs";

/**
 * Configuração de mensagens por empresa (SystemSetting):
 *  - wa_booking_link    : link de divulgação (onde o cliente agenda). Vazio = monta `${endereço do sistema}/agendar/${slug}`.
 *  - wa_footer_enabled  : "0" desliga o rodapé; qualquer outro valor (ou ausente) = ligado.
 *  - wa_footer_text     : texto do rodapé (padrão: "📲 Agende seu horário: {link_agendamento}").
 */
export const SETTING_KEYS = { link: "wa_booking_link", footerEnabled: "wa_footer_enabled", footerText: "wa_footer_text" } as const;

export type MessageSettings = { bookingLink: string; footerEnabled: boolean; footerText: string };

export async function loadMessageSettings(companyId: string): Promise<MessageSettings> {
  const rows = await prisma.systemSetting.findMany({
    where: { companyId, key: { in: Object.values(SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    bookingLink: byKey.get(SETTING_KEYS.link) ?? "",
    footerEnabled: byKey.get(SETTING_KEYS.footerEnabled) !== "0",
    footerText: byKey.get(SETTING_KEYS.footerText) ?? DEFAULT_FOOTER_TEXT,
  };
}

/** O link de agendamento de fato usado: o configurado, ou o do endereço do sistema + slug. null se não der pra montar. */
export async function resolveBookingLink(companyId: string, settings?: MessageSettings): Promise<string | null> {
  const configured = (settings ?? (await loadMessageSettings(companyId))).bookingLink.trim();
  if (configured) return configured;
  const base = await getAppBaseUrl(companyId);
  if (!base) return null;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  return company ? `${base}/agendar/${company.slug}` : null;
}

/** Aplica o rodapé (link de agendamento) a uma mensagem já preenchida. `template` é o texto da regra, pra saber se já usa o link. */
export async function withBookingFooter(companyId: string, message: string, template: string): Promise<string> {
  const settings = await loadMessageSettings(companyId);
  const link = await resolveBookingLink(companyId, settings);
  return applyFooter(message, {
    enabled: settings.footerEnabled,
    text: settings.footerText,
    link,
    templateUsesLink: templateFields(template).includes("link_agendamento"),
  });
}

/** Campo de uso do link dentro do texto (para preencher `{link_agendamento}` quando a mensagem o usa). */
export async function bookingLinkVar(companyId: string): Promise<string> {
  return (await resolveBookingLink(companyId)) ?? "";
}
