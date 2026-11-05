import "server-only";
import { prisma } from "@/lib/prisma";
import { OUTSIDE_HOURS_END, OUTSIDE_HOURS_START } from "@/lib/availability";
import { appointmentClientName } from "@/lib/appointment-client";
import { formatTime } from "@/lib/utils";

/** Quem ocupa a agenda do barbeiro (mesma lista de availability.ts). */
const BUSY_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

type DbClient = Pick<typeof prisma, "appointment" | "barberBlock" | "waitlistEntry" | "barberWorkingHour" | "barberTimeOff" | "barberBreakOverride" | "barber" | "calendarDayMark">;

/**
 * Por que um horário não serve — texto para o usuário (o veredito em si vem de `hasSchedulingConflict`).
 * Usado na edição de agendamento e na prévia das datas de uma recorrência.
 */
export async function explainSchedulingConflict(
  client: DbClient,
  params: { barberId: string; day: Date; startTime: Date; endTime: Date; excludeAppointmentId?: string }
): Promise<string> {
  const other = await client.appointment.findFirst({
    where: {
      barberId: params.barberId,
      appointmentDate: params.day,
      status: { in: [...BUSY_STATUSES] },
      id: params.excludeAppointmentId ? { not: params.excludeAppointmentId } : undefined,
      startTime: { lt: params.endTime },
      endTime: { gt: params.startTime },
    },
    include: { customer: { select: { fullName: true } }, barber: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });
  if (other) {
    return `Já existe outro agendamento nesse horário: ${appointmentClientName(other)}, das ${formatTime(other.startTime)} às ${formatTime(other.endTime)}, com ${other.barber.name}.`;
  }
  const block = await client.barberBlock.findFirst({
    where: { barberId: params.barberId, date: params.day, startTime: { lt: params.endTime }, endTime: { gt: params.startTime } },
  });
  if (block) return "O barbeiro tem um bloqueio de agenda nesse período.";
  const startLabel = formatTime(params.startTime);
  const endLabel = formatTime(params.endTime);
  if (startLabel < OUTSIDE_HOURS_START || endLabel > OUTSIDE_HOURS_END || endLabel === "00:00") {
    return `O atendimento precisa ficar entre ${OUTSIDE_HOURS_START} e ${OUTSIDE_HOURS_END}.`;
  }
  return "Esse horário está reservado para uma vaga da lista de espera.";
}
