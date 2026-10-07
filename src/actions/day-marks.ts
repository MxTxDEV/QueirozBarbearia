"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/require-admin";
import { shopNow } from "@/lib/shop-time";
import { logAudit } from "@/lib/audit";
import { appointmentClientName } from "@/lib/appointment-client";
import { hhmmToMinutes } from "@/lib/quick-slots";
import { MARK_KINDS, MARK_LABEL, validateMarkWindow } from "@/lib/day-marks";
import { formatDate, formatTime } from "@/lib/utils";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

/** Marcar dias na agenda (feriado, folga, fora de expediente). Só ADMIN. */

const MAX_DAYS = 62;
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const markSchema = z.object({
  kind: z.enum(MARK_KINDS),
  startDate: dateString,
  /** Vazio = só o dia de início. */
  endDate: dateString.optional().or(z.literal("")),
  /** Vazio = toda a barbearia. */
  barberId: z.string().optional().or(z.literal("")),
  title: z.string().trim().max(60, "Título muito longo (máx. 60).").optional().or(z.literal("")),
  startTime: z.string().optional().or(z.literal("")),
  endTime: z.string().optional().or(z.literal("")),
});

export type DayMarkInput = z.input<typeof markSchema>;

function revalidate() {
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/dashboard");
  revalidatePath("/portal/[company]", "layout");
}

/** Lista as datas (UTC, meia-noite) de startDate a endDate, validando limites. */
function expandDates(startDate: string, endDate?: string): Date[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate || startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Data inválida.");
  if (end < start) throw new Error("A data final precisa ser depois da inicial.");
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_DAYS) throw new Error(`Marque no máximo ${MAX_DAYS} dias de uma vez.`);
  return Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86_400_000));
}

async function parse(input: DayMarkInput, companyId: string) {
  const data = markSchema.parse(input);
  const windowProblem = data.kind === "OUT_OF_HOURS" ? validateMarkWindow(data.startTime || null, data.endTime || null) : null;
  if (windowProblem) throw new Error(windowProblem);

  const today = new Date(Date.UTC(shopNow().getUTCFullYear(), shopNow().getUTCMonth(), shopNow().getUTCDate()));
  const dates = expandDates(data.startDate, data.endDate || undefined);
  if (dates[dates.length - 1] < today) throw new Error("Esse período já passou.");

  let barberName: string | null = null;
  if (data.barberId) {
    const barber = await prisma.barber.findFirst({ where: { id: data.barberId, companyId }, select: { name: true } });
    if (!barber) throw new Error("Barbeiro não encontrado.");
    barberName = barber.name;
  }
  // Feriado vale para a barbearia toda; só folga e fora de expediente podem ser de um barbeiro.
  const barberId = data.kind === "HOLIDAY" ? null : data.barberId || null;
  const hasWindow = data.kind === "OUT_OF_HOURS" && !!data.startTime && !!data.endTime;
  return {
    kind: data.kind,
    dates,
    barberId,
    barberName: barberId ? barberName : null,
    title: data.title || null,
    startTime: hasWindow ? (data.startTime as string) : null,
    endTime: hasWindow ? (data.endTime as string) : null,
  };
}

/** Agendamentos ativos que ficariam "dentro" do que está sendo fechado (a marcação não cancela nada sozinha). */
async function affectedAppointments(
  companyId: string,
  parsed: { dates: Date[]; barberId: string | null; startTime: string | null; endTime: string | null }
) {
  const rows = await prisma.appointment.findMany({
    where: {
      companyId,
      status: { in: ["PENDING", "CONFIRMED"] },
      appointmentDate: { in: parsed.dates },
      ...(parsed.barberId ? { barberId: parsed.barberId } : {}),
    },
    include: { customer: true, barber: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });
  const winStart = parsed.startTime ? hhmmToMinutes(parsed.startTime) : null;
  const winEnd = parsed.endTime ? hhmmToMinutes(parsed.endTime) : null;
  return rows.filter((a) => {
    if (winStart === null || winEnd === null) return true;
    const s = a.startTime.getUTCHours() * 60 + a.startTime.getUTCMinutes();
    const e = a.endTime.getUTCHours() * 60 + a.endTime.getUTCMinutes() || 24 * 60;
    return s < winEnd && e > winStart;
  });
}

/** Antes de gravar: quantos agendamentos já marcados caem nesses dias (a tela pede confirmação). */
export async function previewDayMarksAction(input: DayMarkInput): Promise<ActionResult<{ days: number; appointments: number; examples: string[] }>> {
  try {
    const user = await requireAdminOnly();
    const parsed = await parse(input, user.companyId);
    const affected = await affectedAppointments(user.companyId, parsed);
    return actionSuccess({
      days: parsed.dates.length,
      appointments: affected.length,
      examples: affected.slice(0, 5).map((a) => `${formatDate(a.appointmentDate)} ${formatTime(a.startTime)} — ${appointmentClientName(a)} (${a.barber.name})`),
    });
  } catch (error) {
    return actionError(error);
  }
}

/** Marca os dias. Se já havia a mesma marcação (mesmo tipo, dia e escopo), ela é substituída. */
export async function createDayMarksAction(input: DayMarkInput): Promise<ActionResult<{ days: number }>> {
  try {
    const user = await requireAdminOnly();
    const parsed = await parse(input, user.companyId);

    await prisma.$transaction(async (tx) => {
      await tx.calendarDayMark.deleteMany({
        where: { companyId: user.companyId, kind: parsed.kind, barberId: parsed.barberId, date: { in: parsed.dates } },
      });
      await tx.calendarDayMark.createMany({
        data: parsed.dates.map((date) => ({
          companyId: user.companyId,
          date,
          kind: parsed.kind,
          barberId: parsed.barberId,
          title: parsed.title,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          createdByUserId: user.id,
        })),
      });
    });

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "calendar_day_marked",
      entityType: "calendar_day_mark",
      entityId: user.companyId,
      metadata: {
        kind: parsed.kind,
        label: MARK_LABEL[parsed.kind],
        from: parsed.dates[0].toISOString().slice(0, 10),
        to: parsed.dates[parsed.dates.length - 1].toISOString().slice(0, 10),
        barberId: parsed.barberId,
        title: parsed.title,
        window: parsed.startTime ? `${parsed.startTime}–${parsed.endTime}` : null,
      },
    });
    revalidate();
    return actionSuccess({ days: parsed.dates.length });
  } catch (error) {
    return actionError(error);
  }
}

/** Remove uma marcação (o dia volta ao expediente normal). */
export async function deleteDayMarkAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const mark = await prisma.calendarDayMark.findFirst({ where: { id, companyId: user.companyId } });
    if (!mark) return actionError(new Error("Marcação não encontrada."));
    await prisma.calendarDayMark.delete({ where: { id } });
    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "calendar_day_unmarked",
      entityType: "calendar_day_mark",
      entityId: id,
      metadata: { kind: mark.kind, date: mark.date.toISOString().slice(0, 10), barberId: mark.barberId },
    });
    revalidate();
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}
