import type { AppointmentMessageData } from "./types";
import { formatNoticeDate } from "@/lib/recurrence-notice";

function servicesList(services: string[]) {
  return services.map((s) => `• ${s}`).join("\n");
}

export function appointmentConfirmationTemplate(d: AppointmentMessageData) {
  return `Olá, ${d.customerName}! 💈

Seu horário foi confirmado.

📅 Data: ${d.date}
⏰ Horário: ${d.time}
✂️ Barbeiro: ${d.barberName}

Serviços:
${servicesList(d.services)}

💰 Total: R$ ${d.totalPrice}

Aguardamos você!`;
}

export function appointmentReminderTemplate(d: AppointmentMessageData) {
  return `Olá, ${d.customerName}! 💈

Passando para lembrar que você possui um horário agendado${d.whenLabel ? ` ${d.whenLabel}` : ""}:

📅 ${d.date}
⏰ ${d.time}
✂️ Barbeiro: ${d.barberName}

Nos vemos em breve!`;
}

export function appointmentCancellationTemplate(d: Pick<AppointmentMessageData, "customerName" | "date" | "time">) {
  return `Olá, ${d.customerName}.

Seu agendamento do dia ${d.date}, às ${d.time}, foi cancelado.

Caso queira, você pode realizar um novo agendamento pelo aplicativo.`;
}

export function newAppointmentInternalTemplate(
  d: AppointmentMessageData & { status?: string }
) {
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

export function serviceThanksTemplate(d: { customerName: string; companyName: string; reviewUrl?: string }) {
  const intro = `Olá, ${d.customerName}! 💈

Muito obrigado pela preferência! Foi um prazer atender você na ${d.companyName}.`;

  if (d.reviewUrl) {
    return `${intro}

Podemos contar com sua avaliação? Isso nos ajuda muito a melhorar:
${d.reviewUrl}

Esperamos você na próxima! 🙌`;
  }

  return `${intro}

Se puder, conte pra gente o que achou do atendimento — sua opinião é muito importante!

Esperamos você na próxima! 🙌`;
}

export function waitlistSlotOfferedTemplate(d: {
  customerName: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  confirmByTime: string;
}) {
  return `Olá, ${d.customerName}! 💈

Horário disponível para você!

✂️ ${d.serviceName}

💈 Barbeiro: ${d.barberName}

📅 Data: ${d.date}

⏰ Horário: ${d.time}

Você tem até ${d.confirmByTime} para confirmar, senão a vaga passa para o próximo da lista de espera.`;
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

export function recurringApprovedTemplate(d: {
  customerName: string;
  serviceName: string;
  barberName: string;
  frequencyLabel: string;
  confirmedCount: number;
  conflictCount: number;
}) {
  const conflictLine =
    d.conflictCount > 0
      ? `\n\n${d.conflictCount} data(s) ficaram indisponíveis e entraram na lista de espera — avisamos assim que surgir uma vaga.`
      : "";
  return `Olá, ${d.customerName}! 💈

Sua recorrência foi confirmada!

✂️ ${d.serviceName}

💈 Barbeiro: ${d.barberName}

🔁 ${d.frequencyLabel}

${d.confirmedCount} horário(s) já reservados na sua agenda.${conflictLine}`;
}

export function recurringRejectedTemplate(d: { customerName: string; serviceName: string; reason?: string }) {
  const reasonLine = d.reason ? `\n\nMotivo: ${d.reason}` : "";
  return `Olá, ${d.customerName}.

Sua solicitação de recorrência para ${d.serviceName} não pôde ser confirmada pelo barbeiro.${reasonLine}

Você pode agendar normalmente ou solicitar uma nova recorrência.`;
}

export function otpTemplate(code: string, companyName: string) {
  return `Seu código de acesso ${companyName} é: ${code}

Válido por 5 minutos. Não compartilhe este código.`;
}

/** Tempo real: o barbeiro/recepção acabou de marcar um horário avulso para o cliente. */
export function appointmentScheduledByShopTemplate(d: AppointmentMessageData & { companyName: string }) {
  return `Olá, ${d.customerName}! 💈

A ${d.companyName} acabou de agendar um horário para você:

📅 Data: ${d.date}
⏰ Horário: ${d.time}
✂️ Barbeiro: ${d.barberName}

Serviços:
${servicesList(d.services)}

💰 Total: R$ ${d.totalPrice}

Se precisar mudar, é só nos avisar por aqui. Até lá!`;
}

/** Tempo real: o barbeiro/recepção marcou o horário E a recorrência do cliente de uma vez. */
export function recurringScheduledByShopTemplate(d: {
  customerName: string;
  companyName: string;
  serviceName: string;
  barberName: string;
  frequencyLabel: string;
  /** Início de cada data já reservada (relógio de parede em UTC), em ordem. */
  dates: Date[];
  /** Quantas datas passaram da lista (só mostramos as primeiras). */
  moreCount: number;
  /** Datas que não foram reservadas por falta de vaga. */
  conflictCount: number;
}) {
  const list = d.dates.map((date) => `• ${formatNoticeDate(date)}`).join("\n");
  const more = d.moreCount > 0 ? `\n… e mais ${d.moreCount} data(s).` : "";
  const conflict =
    d.conflictCount > 0 ? `\n\n${d.conflictCount} data(s) não tinham vaga e vamos combinar com você.` : "";
  return `Olá, ${d.customerName}! 💈

A ${d.companyName} acabou de agendar seu horário e a sua recorrência:

✂️ ${d.serviceName} com ${d.barberName}
🔁 ${d.frequencyLabel}

Datas marcadas:
${list}${more}${conflict}

Todo dia 1º do mês e um dia antes de cada horário, avisamos você por aqui. Se precisar mudar alguma data, é só nos chamar!`;
}

/** Lembrete das 7h do dia: "é hoje". Um por cliente, com todos os horários dele no dia. */
export function morningReminderTemplate(d: {
  customerName: string;
  companyName: string;
  items: { time: string; barberName: string; services: string[] }[];
}) {
  const lines = d.items.map((i) => `⏰ ${i.time} — ${i.services.join(", ")} com ${i.barberName}`).join("\n");
  const intro = d.items.length > 1 ? "Você tem horários marcados hoje" : "Você tem um horário marcado hoje";
  return `Bom dia, ${d.customerName}! ☀️💈

${intro} na ${d.companyName}:

${lines}

Te esperamos! Se não puder vir, avise a gente por aqui.`;
}
