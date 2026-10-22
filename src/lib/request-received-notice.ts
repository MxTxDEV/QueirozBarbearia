import "server-only";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { sendAppointmentRequestReceived } from "@/lib/whatsapp";

/**
 * Aviso em TEMPO REAL pro cliente que acabou de pedir um horário pelo portal: "recebemos o seu pedido,
 * aguarde a confirmação". Só vale enquanto o agendamento está pendente (se já foi confirmado, quem avisa é a
 * mensagem de confirmação). O texto e o liga/desliga vêm de WhatsApp > Mensagens automáticas.
 * Nunca derruba o agendamento: quem chama deve tratar erro como "só log".
 */
export async function notifyAppointmentRequestReceived(appointmentId: string, companyId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId },
    include: { customer: true, barber: true, services: true, company: { select: { name: true } } },
  });
  if (!appt?.customer || appt.status !== "PENDING") return;

  await sendAppointmentRequestReceived(companyId, appt.customer.whatsapp, appt.customer.id, {
    customerName: appt.customer.fullName,
    companyName: appt.company.name,
    date: formatDate(appt.appointmentDate),
    time: formatTime(appt.startTime),
    barberName: appt.barber.name,
    services: appt.services.map((s) => s.serviceName),
    totalPrice: formatCurrency(appt.totalPrice.toString()).replace("R$", "").trim(),
  });
}
