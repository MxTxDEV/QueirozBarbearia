import type { AppointmentMessageData } from "./types";

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

Passando para lembrar que você possui um horário agendado:

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

export function otpTemplate(code: string, companyName: string) {
  return `Seu código de acesso ${companyName} é: ${code}

Válido por 5 minutos. Não compartilhe este código.`;
}
