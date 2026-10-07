import type { AppointmentMessageData } from "./types";
import { formatNoticeDate, monthlyVars, type MonthlyMessageData } from "@/lib/recurrence-notice";
import { KIND_DEFS, renderTemplate, whenLabel, type AutomationKind } from "./automation-defs";

/**
 * Montagem dos valores (`{nome}`, `{data}`…) de cada mensagem automática e as funções que geram o
 * TEXTO PADRÃO. O texto que a barbearia edita na tela fica no banco (WhatsappAutomation.template) e
 * é renderizado com os MESMOS valores — ver src/lib/whatsapp/automations.ts.
 */

export type Vars = Record<string, string | number | undefined>;

const servicesList = (services: string[]) => services.map((s) => `• ${s}`).join("\n");

/** Renderiza o texto padrão de um tipo (usado como base e nos testes). */
export const renderDefault = (kind: AutomationKind, vars: Vars) => renderTemplate(KIND_DEFS[kind].defaultTemplate, vars);

// ---- valores por tipo de mensagem --------------------------------------------------------------

export function appointmentVars(d: AppointmentMessageData & { companyName?: string; when?: string }): Vars {
  return {
    nome: d.customerName,
    barbearia: d.companyName,
    data: d.date,
    hora: d.time,
    barbeiro: d.barberName,
    servicos: servicesList(d.services),
    total: d.totalPrice,
    quando: d.when,
  };
}

export function cancellationVars(d: Pick<AppointmentMessageData, "customerName" | "date" | "time"> & { companyName?: string }): Vars {
  return { nome: d.customerName, barbearia: d.companyName, data: d.date, hora: d.time };
}

export function thanksVars(d: { customerName: string; companyName: string; reviewUrl?: string }): Vars {
  return {
    nome: d.customerName,
    barbearia: d.companyName,
    avaliacao: d.reviewUrl
      ? `Podemos contar com sua avaliação? Isso nos ajuda muito a melhorar:\n${d.reviewUrl}`
      : "Se puder, conte pra gente o que achou do atendimento — sua opinião é muito importante!",
  };
}

export function waitlistVars(d: {
  customerName: string;
  companyName?: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  confirmByTime: string;
}): Vars {
  return { nome: d.customerName, barbearia: d.companyName, servico: d.serviceName, barbeiro: d.barberName, data: d.date, hora: d.time, prazo: d.confirmByTime };
}

export function recurringApprovedVars(d: {
  customerName: string;
  companyName?: string;
  serviceName: string;
  barberName: string;
  frequencyLabel: string;
  confirmedCount: number;
  conflictCount: number;
}): Vars {
  return {
    nome: d.customerName,
    barbearia: d.companyName,
    servico: d.serviceName,
    barbeiro: d.barberName,
    frequencia: d.frequencyLabel,
    reservados: d.confirmedCount,
    observacao:
      d.conflictCount > 0
        ? `${d.conflictCount} data(s) ficaram indisponíveis e entraram na lista de espera — avisamos assim que surgir uma vaga.`
        : "",
  };
}

export function recurringRejectedVars(d: { customerName: string; companyName?: string; serviceName: string; reason?: string }): Vars {
  return { nome: d.customerName, barbearia: d.companyName, servico: d.serviceName, motivo: d.reason ? `Motivo: ${d.reason}` : "" };
}

export function recurringBookedVars(d: {
  customerName: string;
  companyName: string;
  serviceName: string;
  barberName: string;
  frequencyLabel: string;
  dates: Date[];
  moreCount: number;
  conflictCount: number;
}): Vars {
  const list = d.dates.map((date) => `• ${formatNoticeDate(date)}`).join("\n");
  return {
    nome: d.customerName,
    barbearia: d.companyName,
    servico: d.serviceName,
    barbeiro: d.barberName,
    frequencia: d.frequencyLabel,
    datas: d.moreCount > 0 ? `${list}\n… e mais ${d.moreCount} data(s).` : list,
    observacao: d.conflictCount > 0 ? `${d.conflictCount} data(s) não tinham vaga e vamos combinar com você.` : "",
  };
}

export function morningVars(d: {
  customerName: string;
  companyName: string;
  items: { time: string; barberName: string; services: string[] }[];
}): Vars {
  return {
    nome: d.customerName,
    barbearia: d.companyName,
    chamada: d.items.length > 1 ? "Você tem horários marcados hoje" : "Você tem um horário marcado hoje",
    horarios: d.items.map((i) => `⏰ ${i.time} — ${i.services.join(", ")} com ${i.barberName}`).join("\n"),
  };
}

export { whenLabel };

// ---- textos padrão (mantidos como funções: testes e quem não usa a regra da empresa) -------------

export const appointmentConfirmationTemplate = (d: AppointmentMessageData & { companyName?: string }) =>
  renderDefault("CONFIRMATION", appointmentVars(d));
export const appointmentReminderTemplate = (d: AppointmentMessageData & { companyName?: string; when?: string }) =>
  renderDefault("REMINDER_BEFORE", appointmentVars(d));
export const appointmentCancellationTemplate = (d: Pick<AppointmentMessageData, "customerName" | "date" | "time">) =>
  renderDefault("CANCELLATION", cancellationVars(d));
export const serviceThanksTemplate = (d: { customerName: string; companyName: string; reviewUrl?: string }) =>
  renderDefault("THANKS", thanksVars(d));
export const waitlistSlotOfferedTemplate = (d: Parameters<typeof waitlistVars>[0]) => renderDefault("WAITLIST_OFFER", waitlistVars(d));
export const recurringApprovedTemplate = (d: Parameters<typeof recurringApprovedVars>[0]) =>
  renderDefault("RECURRING_APPROVED", recurringApprovedVars(d));
export const recurringRejectedTemplate = (d: Parameters<typeof recurringRejectedVars>[0]) =>
  renderDefault("RECURRING_REJECTED", recurringRejectedVars(d));
export const appointmentScheduledByShopTemplate = (d: AppointmentMessageData & { companyName: string }) =>
  renderDefault("BOOKED_BY_SHOP", appointmentVars(d));
export const recurringScheduledByShopTemplate = (d: Parameters<typeof recurringBookedVars>[0]) =>
  renderDefault("RECURRING_BOOKED_BY_SHOP", recurringBookedVars(d));
export const morningReminderTemplate = (d: Parameters<typeof morningVars>[0]) => renderDefault("REMINDER_MORNING", morningVars(d));

export const monthlyRecurrenceMessage = (d: MonthlyMessageData) => renderDefault("MONTHLY_SUMMARY", monthlyVars(d));

// ---- mensagens de sistema (não editáveis) -------------------------------------------------------

export function newAppointmentInternalTemplate(d: AppointmentMessageData & { status?: string }) {
  return `🔔 NOVO AGENDAMENTO

Cliente: ${d.customerName}

Barbeiro: ${d.barberName}

Data: ${d.date}

Horário: ${d.time}

Serviços:
${servicesList(d.services)}

Valor: R$ ${d.totalPrice}

Status: ${d.status ?? "Aguardando confirmação"}`;
}

export function recurringRequestInternalTemplate(d: {
  customerName: string;
  serviceName: string;
  barberName: string;
  time: string;
  frequencyLabel: string;
  startDate: string;
  occurrencesLabel: string;
}) {
  return `🔁 NOVA SOLICITAÇÃO DE RECORRÊNCIA

Cliente: ${d.customerName}

Serviço: ${d.serviceName}

Barbeiro: ${d.barberName}

Horário: ${d.time}

Frequência: ${d.frequencyLabel}

Início: ${d.startDate}

${d.occurrencesLabel}

Acesse o painel para analisar.`;
}

export function otpTemplate(code: string, companyName: string) {
  return `Seu código de acesso ${companyName} é: ${code}

Válido por 5 minutos. Não compartilhe este código.`;
}
