import "server-only";
import { prisma } from "@/lib/prisma";
import { sendServiceThanks } from "@/lib/whatsapp";

/**
 * Dispara a mensagem de agradecimento + pedido de avaliação quando o
 * atendimento está concluído E o pagamento acabou de ser confirmado — os
 * dois pontos de entrada (registro manual de pagamento e fechamento de
 * venda no PDV vinculada a um agendamento) chamam esta função depois de
 * garantir as duas condições.
 *
 * Idempotente via reviewRequestSentAt: o carimbo acontece ANTES do envio
 * (não depois) dentro de um updateMany condicionado a reviewRequestSentAt
 * IS NULL — então mesmo que o pagamento seja registrado mais de uma vez
 * para o mesmo agendamento, ou as duas chamadas cheguem quase juntas, só a
 * primeira consegue carimbar e só ela envia a mensagem.
 */
export async function sendServiceThanksIfDue(companyId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId, status: "COMPLETED", reviewRequestSentAt: null },
    include: { customer: true },
  });
  if (!appointment) return;

  const stamped = await prisma.appointment.updateMany({
    where: { id: appointmentId, reviewRequestSentAt: null },
    data: { reviewRequestSentAt: new Date() },
  });
  if (stamped.count === 0) return;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, reviewLinkUrl: true },
  });
  if (!company) return;

  await sendServiceThanks(companyId, appointment.customer.whatsapp, appointment.customer.id, {
    customerName: appointment.customer.fullName,
    companyName: company.name,
    reviewUrl: company.reviewLinkUrl ?? undefined,
  });
}
