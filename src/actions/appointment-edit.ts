"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext, type CompanyUser } from "@/lib/require-admin";
import { hasSchedulingConflict, OUTSIDE_HOURS_END, OUTSIDE_HOURS_START } from "@/lib/availability";
import { shopNow } from "@/lib/shop-time";
import { appointmentClientName } from "@/lib/appointment-client";
import { logAudit } from "@/lib/audit";
import { formatTime } from "@/lib/utils";
import { toNumber } from "@/lib/serialize";
import {
  EDIT_MAX_DURATION_MIN,
  EDIT_MIN_DURATION_MIN,
  buildEditTimes,
  isRealDateTime,
  sameServiceSet,
  toDateInput,
  toTimeInput,
} from "@/lib/appointment-edit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

/** Quem ocupa a agenda do barbeiro (mesma lista de availability.ts). */
const BUSY_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

class EditError extends Error {}

const editSchema = z
  .object({
    appointmentId: z.string().min(1),
    /** Só vale para agendamento de cliente cadastrado; nulo/ausente = mantém. */
    customerId: z.string().min(1).nullable().optional(),
    /** Só vale para agendamento de cliente avulso (sem cadastro). */
    walkInName: z.string().trim().max(80, "O nome pode ter no máximo 80 caracteres.").nullable().optional(),
    barberId: z.string().min(1, "Escolha o barbeiro."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
    durationMin: z
      .number({ error: "Informe a duração." })
      .int("A duração deve ser em minutos inteiros.")
      .min(EDIT_MIN_DURATION_MIN, `A duração mínima é de ${EDIT_MIN_DURATION_MIN} minutos.`)
      .max(EDIT_MAX_DURATION_MIN, "A duração máxima é de 12 horas."),
    serviceIds: z.array(z.string().min(1)).min(1, "Escolha ao menos um serviço.").max(10, "No máximo 10 serviços."),
    notes: z.string().max(500, "A observação pode ter no máximo 500 caracteres.").nullable().optional(),
  })
  .refine((d) => isRealDateTime(d.date, d.time), { message: "Data ou horário inválido.", path: ["date"] });

export type EditAppointmentInput = z.input<typeof editSchema>;

export type EditAppointmentData = {
  id: string;
  status: string;
  customerId: string | null;
  walkInName: string | null;
  barberId: string;
  /** AAAA-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  durationMin: number;
  serviceIds: string[];
  notes: string;
  /** Valor total atual (R$). */
  price: number;
  /** false = já existe pagamento/venda: trocar serviços mudaria o valor já cobrado. */
  canEditServices: boolean;
  barbers: { id: string; name: string; serviceIds: string[] }[];
  services: { id: string; name: string; price: number; durationMinutes: number; active: boolean }[];
  /** Só vem preenchido para agendamento de cliente cadastrado. */
  customers: { id: string; fullName: string; whatsapp: string }[];
};

/** Dados para montar a janela de edição (tudo da empresa do usuário; o cliente nunca é confiável). */
export async function getAppointmentEditDataAction(appointmentId: string): Promise<ActionResult<EditAppointmentData>> {
  try {
    const user = await requireAdminContext();
    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, companyId: user.companyId },
      include: { services: true, payments: { select: { id: true } }, sale: { select: { id: true } } },
    });
    if (!appt) return actionError(new Error("Agendamento não encontrado."));
    if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") {
      return actionError(new Error("Só dá pra editar agendamentos pendentes ou confirmados."));
    }
    if (user.role === "BARBER" && appt.barberId !== user.barberId) {
      return actionError(new Error("Você só pode editar os seus próprios agendamentos."));
    }

    const currentServiceIds = appt.services.map((s) => s.serviceId);
    const [barbers, services, customers] = await Promise.all([
      prisma.barber.findMany({
        where: {
          companyId: user.companyId,
          ...(user.role === "BARBER" ? { id: user.barberId ?? "__none__" } : { OR: [{ active: true }, { id: appt.barberId }] }),
        },
        orderBy: { name: "asc" },
        include: { services: { select: { serviceId: true } } },
      }),
      prisma.service.findMany({
        where: { companyId: user.companyId, OR: [{ active: true }, { id: { in: currentServiceIds } }] },
        orderBy: { name: "asc" },
      }),
      appt.customerId
        ? prisma.customer.findMany({
            where: { companyId: user.companyId },
            orderBy: { fullName: "asc" },
            select: { id: true, fullName: true, whatsapp: true },
          })
        : Promise.resolve([]),
    ]);

    return actionSuccess({
      id: appt.id,
      status: appt.status,
      customerId: appt.customerId,
      walkInName: appt.walkInName,
      barberId: appt.barberId,
      date: toDateInput(appt.appointmentDate),
      time: toTimeInput(appt.startTime),
      durationMin: Math.round((appt.endTime.getTime() - appt.startTime.getTime()) / 60_000),
      serviceIds: currentServiceIds,
      notes: appt.notes ?? "",
      price: toNumber(appt.totalPrice),
      canEditServices: appt.payments.length === 0 && !appt.sale,
      barbers: barbers.map((b) => ({ id: b.id, name: b.name, serviceIds: b.services.map((s) => s.serviceId) })),
      services: services.map((s) => ({ id: s.id, name: s.name, price: toNumber(s.price), durationMinutes: s.durationMinutes, active: s.active })),
      customers,
    });
  } catch (error) {
    return actionError(error);
  }
}

type DbClient = Pick<typeof prisma, "appointment" | "barberBlock" | "waitlistEntry" | "barberWorkingHour" | "barberTimeOff" | "barberBreakOverride" | "barber" | "calendarDayMark">;

/** Por que o horário não serve — texto para o usuário (o veredito em si vem de hasSchedulingConflict). */
async function explainConflict(
  client: DbClient,
  params: { barberId: string; day: Date; startTime: Date; endTime: Date; excludeAppointmentId: string }
): Promise<string> {
  const other = await client.appointment.findFirst({
    where: {
      barberId: params.barberId,
      appointmentDate: params.day,
      status: { in: [...BUSY_STATUSES] },
      id: { not: params.excludeAppointmentId },
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

type EditPlan = {
  appt: NonNullable<Awaited<ReturnType<typeof loadForEdit>>>;
  data: z.infer<typeof editSchema>;
  barberName: string;
  barberChanged: boolean;
  startChanged: boolean;
  timingChanged: boolean;
  servicesChanged: boolean;
  newServices: { id: string; name: string; price: Prisma.Decimal; durationMinutes: number }[];
  newCustomerId: string | null;
  newWalkInName: string | null;
  notes: string | null;
  times: ReturnType<typeof buildEditTimes>;
  changes: string[];
};

async function loadForEdit(appointmentId: string, companyId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, companyId },
    include: {
      customer: true,
      barber: true,
      services: true,
      payments: { select: { id: true } },
      sale: { select: { id: true } },
    },
  });
}

/**
 * Valida tudo o que NÃO depende da transação (existência, permissão, serviços, horário no passado).
 * Não grava nada. O conflito com outro agendamento é checado à parte (preview) e de novo, de verdade,
 * dentro da transação Serializable ao salvar.
 */
async function prepareEdit(user: CompanyUser, input: EditAppointmentInput): Promise<{ plan: EditPlan } | { error: string; noChanges?: boolean }> {
  const data = editSchema.parse(input);

  const appt = await loadForEdit(data.appointmentId, user.companyId);
  if (!appt) return { error: "Agendamento não encontrado." };
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") {
    return { error: "Só dá pra editar agendamentos pendentes ou confirmados." };
  }
  if (user.role === "BARBER" && (appt.barberId !== user.barberId || data.barberId !== user.barberId)) {
    return { error: "Você só pode editar os seus próprios agendamentos." };
  }

  // --- cliente ---
  let newCustomerId: string | null = null;
  let newWalkInName: string | null = null;
  if (appt.customerId) {
    newCustomerId = data.customerId ?? appt.customerId;
    if (newCustomerId !== appt.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: newCustomerId, companyId: user.companyId }, select: { id: true } });
      if (!customer) return { error: "Cliente não encontrado." };
    }
  } else {
    newWalkInName = (data.walkInName ?? "").trim();
    if (!newWalkInName) return { error: "Informe o nome do cliente." };
  }

  // --- barbeiro ---
  const barberChanged = data.barberId !== appt.barberId;
  const barber = barberChanged ? await prisma.barber.findFirst({ where: { id: data.barberId, companyId: user.companyId } }) : appt.barber;
  if (!barber || (barberChanged && !barber.active)) return { error: "Barbeiro indisponível." };

  // --- serviços ---
  const wantedServiceIds = [...new Set(data.serviceIds)];
  const currentServiceIds = appt.services.map((s) => s.serviceId);
  const servicesChanged = !sameServiceSet(currentServiceIds, wantedServiceIds);
  let newServices: EditPlan["newServices"] = [];
  if (servicesChanged) {
    if (appt.payments.length > 0 || appt.sale) {
      return { error: "Esse agendamento já tem pagamento registrado — não dá pra trocar os serviços." };
    }
    const found = await prisma.service.findMany({ where: { id: { in: wantedServiceIds }, companyId: user.companyId } });
    if (found.length !== wantedServiceIds.length) return { error: "Um ou mais serviços não existem mais." };
    const unavailable = found.filter((s) => !s.active && !currentServiceIds.includes(s.id));
    if (unavailable.length > 0) return { error: `Serviço indisponível: ${unavailable.map((s) => s.name).join(", ")}.` };
    newServices = found.map((s) => ({ id: s.id, name: s.name, price: s.price, durationMinutes: s.durationMinutes }));
  }
  if (barberChanged || servicesChanged) {
    const offered = await prisma.barberService.findMany({ where: { barberId: data.barberId, serviceId: { in: wantedServiceIds } }, select: { serviceId: true } });
    const offeredIds = new Set(offered.map((o) => o.serviceId));
    const missing = wantedServiceIds.filter((id) => !offeredIds.has(id));
    if (missing.length > 0) {
      const names = servicesChanged
        ? newServices.filter((s) => missing.includes(s.id)).map((s) => s.name)
        : appt.services.filter((s) => missing.includes(s.serviceId)).map((s) => s.serviceName);
      return { error: `${barber.name} não faz: ${names.join(", ")}.` };
    }
  }

  // --- horário ---
  const times = buildEditTimes(data.date, data.time, data.durationMin);
  if (!times.sameDay) return { error: "O atendimento não pode passar da meia-noite." };
  const startChanged = times.startTime.getTime() !== appt.startTime.getTime();
  const endChanged = times.endTime.getTime() !== appt.endTime.getTime();
  const timingChanged = startChanged || endChanged || barberChanged;
  // Um agendamento que já está no passado só pode mudar de lugar se for para o futuro.
  if ((startChanged || barberChanged) && times.startTime.getTime() < shopNow().getTime() - 60_000) {
    return { error: "Não dá pra marcar para um horário que já passou." };
  }

  // --- o que mudou (para o aviso e o registro de auditoria) ---
  const notes = (data.notes ?? "").trim() || null;
  const changes: string[] = [];
  if (appt.customerId && newCustomerId !== appt.customerId) changes.push("cliente");
  if (!appt.customerId && newWalkInName !== (appt.walkInName ?? "")) changes.push("nome do cliente");
  if (barberChanged) changes.push("barbeiro");
  if (startChanged) changes.push("data/horário");
  if (times.endTime.getTime() - times.startTime.getTime() !== appt.endTime.getTime() - appt.startTime.getTime()) changes.push("duração");
  if (servicesChanged) changes.push("serviços");
  if (notes !== (appt.notes ?? null)) changes.push("observação");
  if (changes.length === 0) return { error: "Nenhuma alteração para salvar.", noChanges: true };

  return {
    plan: {
      appt,
      data,
      barberName: barber.name,
      barberChanged,
      startChanged,
      timingChanged,
      servicesChanged,
      newServices,
      newCustomerId,
      newWalkInName,
      notes,
      times,
      changes,
    },
  };
}

/**
 * Pré-visualização enquanto o usuário mexe na janela: o horário novo está livre?
 * (só leitura — quem garante de verdade é `updateAppointmentAction`, em transação.)
 */
export async function checkAppointmentEditAction(
  input: EditAppointmentInput
): Promise<ActionResult<{ available: boolean; message?: string; endLabel: string; unchanged?: boolean }>> {
  try {
    const user = await requireAdminContext();
    const prepared = await prepareEdit(user, input);
    if ("error" in prepared) {
      if (prepared.noChanges) {
        const t = buildEditTimes(input.date, input.time, input.durationMin);
        return actionSuccess({ available: true, unchanged: true, endLabel: formatTime(t.endTime) });
      }
      return actionSuccess({ available: false, message: prepared.error, endLabel: "" });
    }
    const { plan } = prepared;
    const endLabel = formatTime(plan.times.endTime);
    if (plan.timingChanged) {
      const conflict = await hasSchedulingConflict({
        barberId: plan.data.barberId,
        startTime: plan.times.startTime,
        endTime: plan.times.endTime,
        excludeAppointmentId: plan.appt.id,
        allowOutsideHours: true,
      });
      if (conflict) {
        const message = await explainConflict(prisma, {
          barberId: plan.data.barberId,
          day: plan.times.appointmentDate,
          startTime: plan.times.startTime,
          endTime: plan.times.endTime,
          excludeAppointmentId: plan.appt.id,
        });
        return actionSuccess({ available: false, message, endLabel });
      }
    }
    return actionSuccess({ available: true, endLabel });
  } catch (error) {
    if (error instanceof z.ZodError) return actionSuccess({ available: false, message: error.issues[0]?.message ?? "Verifique os campos.", endLabel: "" });
    return actionError(error);
  }
}

/**
 * Salva a edição de UM agendamento pendente/confirmado: cliente, barbeiro, data, horário, duração,
 * serviços e observação. É o MESMO agendamento que muda (histórico, vínculo com a recorrência e
 * confirmação por link continuam). A data/horário/barbeiro só mudam se não houver outro agendamento
 * (nem bloqueio) no período novo — checado dentro da transação Serializable.
 */
export async function updateAppointmentAction(input: EditAppointmentInput): Promise<ActionResult<{ changes: string[] }>> {
  try {
    const user = await requireAdminContext();
    const prepared = await prepareEdit(user, input);
    if ("error" in prepared) return actionError(new Error(prepared.error));
    const { plan } = prepared;
    const { appt, data, times } = plan;

    await prisma.$transaction(
      async (tx) => {
        if (plan.timingChanged) {
          const conflict = await hasSchedulingConflict(
            { barberId: data.barberId, startTime: times.startTime, endTime: times.endTime, excludeAppointmentId: appt.id, allowOutsideHours: true },
            tx
          );
          if (conflict) {
            throw new EditError(
              await explainConflict(tx, { barberId: data.barberId, day: times.appointmentDate, startTime: times.startTime, endTime: times.endTime, excludeAppointmentId: appt.id })
            );
          }
        }

        if (plan.servicesChanged) {
          await tx.appointmentService.deleteMany({ where: { appointmentId: appt.id } });
          await tx.appointmentService.createMany({
            data: plan.newServices.map((s) => ({
              appointmentId: appt.id,
              serviceId: s.id,
              serviceName: s.name,
              priceAtBooking: s.price,
              durationAtBooking: s.durationMinutes,
            })),
          });
        }

        await tx.appointment.update({
          where: { id: appt.id },
          data: {
            ...(appt.customerId ? { customerId: plan.newCustomerId } : { walkInName: plan.newWalkInName }),
            barberId: data.barberId,
            appointmentDate: times.appointmentDate,
            startTime: times.startTime,
            endTime: times.endTime,
            totalDurationMin: data.durationMin,
            ...(plan.servicesChanged ? { totalPrice: plan.newServices.reduce((sum, s) => sum.add(s.price), new Prisma.Decimal(0)) } : {}),
            notes: plan.notes,
            // Horário novo: os lembretes automáticos e a confirmação do cliente valiam para o horário antigo.
            ...(plan.startChanged
              ? { reminder24hSentAt: null, reminder1hSentAt: null, reminderMorningSentAt: null, clientConfirmedAt: null }
              : plan.barberChanged
                ? { clientConfirmedAt: null }
                : {}),
          },
        });

        // Agendamento de recorrência: a ocorrência acompanha o dia/horário novo.
        if (plan.timingChanged) {
          await tx.recurringAppointmentOccurrence.updateMany({
            where: { appointmentId: appt.id, recurringAppointment: { companyId: user.companyId } },
            data: { scheduledDate: times.appointmentDate, scheduledStartTime: times.startTime, scheduledEndTime: times.endTime },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "appointment_edited",
      entityType: "appointment",
      entityId: appt.id,
      appointmentId: appt.id,
      metadata: {
        changes: plan.changes,
        from: {
          customerId: appt.customerId,
          barberId: appt.barberId,
          startTime: appt.startTime.toISOString(),
          endTime: appt.endTime.toISOString(),
          services: appt.services.map((s) => s.serviceName),
        },
        to: {
          customerId: plan.newCustomerId,
          barberId: data.barberId,
          startTime: times.startTime.toISOString(),
          endTime: times.endTime.toISOString(),
          services: plan.servicesChanged ? plan.newServices.map((s) => s.name) : appt.services.map((s) => s.serviceName),
        },
      },
    });

    revalidatePath("/admin/appointments");
    revalidatePath("/admin/recurring-appointments");
    revalidatePath("/portal/[company]", "layout");
    return actionSuccess({ changes: plan.changes });
  } catch (error) {
    if (error instanceof EditError) return actionError(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return actionError(new Error("Outra alteração aconteceu ao mesmo tempo. Tente de novo."));
    }
    return actionError(error);
  }
}
