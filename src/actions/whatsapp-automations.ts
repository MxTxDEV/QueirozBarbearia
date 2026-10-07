"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit";
import { normalizeWhatsapp } from "@/lib/utils";
import { sendWhatsapp } from "@/lib/whatsapp";
import { ensureAutomations } from "@/lib/whatsapp/automations";
import { SETTING_KEYS, bookingLinkVar, withBookingFooter } from "@/lib/whatsapp/message-settings";
import {
  AUDIENCES,
  HHMM,
  KIND_DEFS,
  MAX_OFFSET_MINUTES,
  MIN_OFFSET_MINUTES,
  renderTemplate,
  sampleVars,
  templateFields,
  validateTemplate,
  isAutomationKind,
  type AutomationKind,
} from "@/lib/whatsapp/automation-defs";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

/** Quantas regras por tipo — evita uma tela (e um cron) sem fim. */
const MAX_RULES_PER_KIND = 10;

const saveSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Dê um nome para a mensagem.").max(80, "Nome muito longo."),
  enabled: z.boolean(),
  /** null = voltar ao texto padrão do sistema. */
  template: z.string().nullable(),
  audience: z.enum(AUDIENCES),
  offsetMinutes: z.coerce.number().int().nullable().optional(),
  sendTime: z.string().nullable().optional(),
  dayOfMonth: z.coerce.number().int().nullable().optional(),
});

export type SaveAutomationInput = z.input<typeof saveSchema>;

function revalidate() {
  revalidatePath("/admin/whatsapp");
}

/** Salva uma regra: liga/desliga, texto, para qual tipo de cliente e quando sai. */
export async function saveAutomationAction(input: SaveAutomationInput): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const data = saveSchema.parse(input);

    const rule = await prisma.whatsappAutomation.findFirst({ where: { id: data.id, companyId: user.companyId } });
    if (!rule) return actionError(new Error("Mensagem não encontrada."));
    const kind = rule.kind as AutomationKind;
    const def = KIND_DEFS[kind];

    if (data.template !== null) {
      const problem = validateTemplate(kind, data.template);
      if (problem) return actionError(new Error(problem));
    }

    let offsetMinutes: number | null = null;
    let sendTime: string | null = null;
    let dayOfMonth: number | null = null;

    if (def.timing === "before") {
      const offset = data.offsetMinutes;
      if (!offset || offset < MIN_OFFSET_MINUTES || offset > MAX_OFFSET_MINUTES) {
        return actionError(new Error("O lembrete precisa sair entre 5 minutos e 7 dias antes do horário."));
      }
      offsetMinutes = offset;
    }
    if (def.timing === "morning" || def.timing === "monthly") {
      if (!data.sendTime || !HHMM.test(data.sendTime)) return actionError(new Error("Informe um horário válido (ex: 07:00)."));
      sendTime = data.sendTime;
    }
    if (def.timing === "monthly") {
      if (!data.dayOfMonth || data.dayOfMonth < 1 || data.dayOfMonth > 28) {
        return actionError(new Error("O dia do mês precisa estar entre 1 e 28."));
      }
      dayOfMonth = data.dayOfMonth;
    }

    await prisma.whatsappAutomation.update({
      where: { id: rule.id },
      data: {
        name: data.name,
        enabled: data.enabled,
        template: data.template === null ? null : data.template.trim(),
        audience: data.audience,
        offsetMinutes,
        sendTime,
        dayOfMonth,
      },
    });

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "whatsapp_automation_updated",
      entityType: "whatsapp_automation",
      entityId: rule.id,
      metadata: { kind, enabled: data.enabled, customText: data.template !== null, audience: data.audience, offsetMinutes, sendTime, dayOfMonth },
    });

    revalidate();
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Cria uma nova regra do tipo: uma cópia de outra (ex: o mesmo lembrete com texto diferente para outro
 * tipo de cliente) ou, nos lembretes "antes do horário", um novo lembrete (ex: 2 horas antes).
 */
export async function createAutomationAction(input: { kind: string; copyFromId?: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdminOnly();
    if (!isAutomationKind(input.kind)) return actionError(new Error("Tipo de mensagem inválido."));
    const kind = input.kind;
    await ensureAutomations(user.companyId);

    const count = await prisma.whatsappAutomation.count({ where: { companyId: user.companyId, kind } });
    if (count >= MAX_RULES_PER_KIND) return actionError(new Error(`Limite de ${MAX_RULES_PER_KIND} mensagens deste tipo.`));

    const source = input.copyFromId
      ? await prisma.whatsappAutomation.findFirst({ where: { id: input.copyFromId, companyId: user.companyId, kind } })
      : null;
    const def = KIND_DEFS[kind];

    const created = await prisma.whatsappAutomation.create({
      data: {
        companyId: user.companyId,
        key: `custom:${randomUUID()}`,
        kind,
        name: source ? `${source.name} (cópia)`.slice(0, 80) : kind === "REMINDER_BEFORE" ? "Novo lembrete" : `${def.label} — variação`.slice(0, 80),
        enabled: true,
        template: source?.template ?? null,
        // Variação nasce pra um tipo de cliente específico (se for igual à original, uma não ganharia da outra).
        audience: source ? (source.audience === "ALL" ? "NEW" : source.audience) : "ALL",
        offsetMinutes: def.timing === "before" ? (source?.offsetMinutes ?? 120) : null,
        sendTime: def.timing === "morning" || def.timing === "monthly" ? (source?.sendTime ?? (def.timing === "morning" ? "07:00" : "09:00")) : null,
        dayOfMonth: def.timing === "monthly" ? (source?.dayOfMonth ?? 1) : null,
        sortOrder: count,
      },
    });

    revalidate();
    return actionSuccess({ id: created.id });
  } catch (error) {
    return actionError(error);
  }
}

/** Exclui uma regra. Cada tipo precisa manter pelo menos uma (para só parar de enviar, desligue); lembretes antes do horário podem ficar sem nenhuma. */
export async function deleteAutomationAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const rule = await prisma.whatsappAutomation.findFirst({ where: { id, companyId: user.companyId } });
    if (!rule) return actionError(new Error("Mensagem não encontrada."));

    if (rule.kind !== "REMINDER_BEFORE") {
      const others = await prisma.whatsappAutomation.count({ where: { companyId: user.companyId, kind: rule.kind, id: { not: id } } });
      if (others === 0) return actionError(new Error("Este tipo precisa de pelo menos uma mensagem. Para parar de enviar, é só desligar."));
    }

    await prisma.whatsappAutomation.delete({ where: { id } });
    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "whatsapp_automation_deleted",
      entityType: "whatsapp_automation",
      entityId: id,
      metadata: { kind: rule.kind, name: rule.name },
    });

    revalidate();
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

const testSchema = z.object({
  kind: z.string(),
  template: z.string(),
  phone: z.string().min(8, "Informe o WhatsApp que vai receber o teste."),
});

/** Manda a mensagem (com dados de exemplo) para um número, pra ver como chega — não conta como envio a cliente. */
export async function sendTestAutomationAction(input: z.input<typeof testSchema>): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const data = testSchema.parse(input);
    if (!isAutomationKind(data.kind)) return actionError(new Error("Tipo de mensagem inválido."));
    const problem = validateTemplate(data.kind, data.template);
    if (problem) return actionError(new Error(problem));

    const phone = normalizeWhatsapp(data.phone);
    if (!phone) return actionError(new Error("Número de WhatsApp inválido. Use o formato (DD) 9XXXX-XXXX."));

    const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } });
    const filled = renderTemplate(data.template, {
      ...sampleVars(data.kind),
      barbearia: company?.name ?? "",
      link_agendamento: await bookingLinkVar(user.companyId),
    });
    const message = await withBookingFooter(user.companyId, filled, data.template);
    const result = await sendWhatsapp({ companyId: user.companyId, phone, message: `🧪 TESTE (dados de exemplo)\n\n${message}` });
    if (!result.ok) return actionError(new Error(result.errorMessage ?? "Não foi possível enviar o teste."));
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

const settingsSchema = z.object({
  /** Vazio = usa o endereço do sistema + /agendar/{slug}. */
  bookingLink: z
    .string()
    .trim()
    .max(300, "Link muito longo.")
    .refine((value) => value === "" || /^https?:\/\/[^\s]+$/i.test(value), "O link precisa começar com https:// (ex: https://seusite.com/agendar/sua-barbearia)."),
  footerEnabled: z.boolean(),
  footerText: z.string().trim().min(1, "Escreva o texto do rodapé.").max(300, "Rodapé muito longo."),
});

/** Salva o link de divulgação e o rodapé que vai no fim de toda mensagem automática. */
export async function saveMessageSettingsAction(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const data = settingsSchema.parse(input);

    const unknown = templateFields(data.footerText).filter((field) => field !== "link_agendamento");
    if (unknown.length > 0) return actionError(new Error(`No rodapé só dá pra usar o campo {link_agendamento} (encontrei: ${unknown.map((u) => `{${u}}`).join(", ")}).`));

    const entries: [string, string][] = [
      [SETTING_KEYS.link, data.bookingLink],
      [SETTING_KEYS.footerEnabled, data.footerEnabled ? "1" : "0"],
      [SETTING_KEYS.footerText, data.footerText],
    ];
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { companyId_key: { companyId: user.companyId, key } },
          create: { companyId: user.companyId, key, value },
          update: { value },
        })
      )
    );

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "whatsapp_message_settings_updated",
      entityType: "company",
      entityId: user.companyId,
      metadata: { bookingLink: data.bookingLink, footerEnabled: data.footerEnabled },
    });
    revalidate();
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}
