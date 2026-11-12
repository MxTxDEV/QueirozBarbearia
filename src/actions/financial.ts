"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit";
import { appointmentClientName } from "@/lib/appointment-client";
import { nextRecurrenceDate } from "@/lib/recurrence";
import { sendServiceThanksIfDue } from "@/lib/service-thanks";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";
import type { PaymentMethod, RecurrenceType } from "@prisma/client";

const paymentMethodEnum = z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "OTHER"]);

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Informe um valor válido."),
  paymentMethod: paymentMethodEnum,
  paidAt: z.string().min(1, "Informe a data do pagamento."),
});

/** Serviço extra feito na hora (ex: o cliente cortou e resolveu fazer a barba), com o valor cobrado. */
const extraServicesSchema = z
  .array(
    z.object({
      serviceId: z.string().min(1, "Selecione o serviço adicional."),
      price: z.coerce.number().min(0, "Valor do serviço adicional inválido.").max(100000, "Valor do serviço adicional inválido."),
    })
  )
  .max(10, "Máximo de 10 serviços adicionais.");

function parseExtras(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Serviços adicionais inválidos.");
  }
  return extraServicesSchema.parse(json);
}

/** Registra o pagamento de um agendamento concluído — cria a receita financeira (Regra 4). */
export async function registerPaymentAction(
  appointmentId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = paymentSchema.parse({
      amount: formData.get("amount"),
      paymentMethod: formData.get("paymentMethod"),
      paidAt: formData.get("paidAt"),
    });

    const extras = parseExtras(formData.get("extras"));

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, companyId: user.companyId },
      include: { customer: true, payments: { select: { id: true }, take: 1 } },
    });
    if (!appointment) return actionError(new Error("Agendamento não encontrado."));
    if (appointment.status !== "COMPLETED") {
      return actionError(new Error("Só é possível registrar pagamento de agendamentos concluídos."));
    }
    // Evita lançar duas vezes (duplo clique / aba antiga) — e, com serviços adicionais, somá-los duas vezes.
    if (appointment.payments.length > 0) {
      return actionError(new Error("O pagamento deste agendamento já foi registrado."));
    }

    const extraServices = extras.length
      ? await prisma.service.findMany({
          where: { id: { in: extras.map((e) => e.serviceId) }, companyId: user.companyId, active: true },
        })
      : [];
    const servicesById = new Map(extraServices.map((service) => [service.id, service]));
    if (extras.some((e) => !servicesById.has(e.serviceId))) {
      return actionError(new Error("Serviço adicional não encontrado."));
    }
    const extrasTotal = extras.reduce((sum, e) => sum + e.price, 0);

    const paidAt = new Date(data.paidAt);

    await prisma.$transaction([
      // Serviço de última hora entra no agendamento pelo valor efetivamente cobrado —
      // assim o histórico do cliente e os relatórios por serviço enxergam o que foi feito.
      ...extras.map((e) =>
        prisma.appointmentService.create({
          data: {
            appointmentId,
            serviceId: e.serviceId,
            serviceName: servicesById.get(e.serviceId)!.name,
            priceAtBooking: e.price,
            durationAtBooking: servicesById.get(e.serviceId)!.durationMinutes,
          },
        })
      ),
      ...(extras.length
        ? [prisma.appointment.update({ where: { id: appointmentId }, data: { totalPrice: { increment: extrasTotal } } })]
        : []),
      prisma.payment.create({
        data: {
          companyId: user.companyId,
          appointmentId,
          customerId: appointment.customerId ?? undefined,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          paidAt,
        },
      }),
      prisma.financialTransaction.create({
        data: {
          companyId: user.companyId,
          type: "INCOME",
          category: "Serviços",
          description: `Pagamento — ${appointmentClientName(appointment)}`,
          amount: data.amount,
          transactionDate: paidAt,
          paymentMethod: data.paymentMethod,
          appointmentId,
          barberId: appointment.barberId,
          customerId: appointment.customerId ?? undefined,
          status: "PAID",
        },
      }),
    ]);

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "payment_registered",
      entityType: "appointment",
      entityId: appointmentId,
      appointmentId,
      metadata: {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        ...(extras.length ? { extraServices: extras.map((e) => ({ ...e, name: servicesById.get(e.serviceId)!.name })) } : {}),
      },
    });

    // Serviço já estava concluído (checado acima) e o pagamento acabou de
    // ser confirmado — as duas condições para o agradecimento automático.
    await sendServiceThanksIfDue(user.companyId, appointmentId);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/appointments");
  revalidatePath("/admin/financial");
  redirect("/admin/appointments");
}

const editPaymentsSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      amount: z.coerce.number().positive("Informe um valor válido.").max(1_000_000, "Valor inválido."),
      paymentMethod: paymentMethodEnum,
      paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data do pagamento inválida."),
    })
  )
  .min(1)
  .max(20);

/**
 * Corrige o pagamento já registrado de um agendamento (valor, forma e data). Atualiza o pagamento e a receita
 * correspondente no financeiro, para o faturamento, as metas e os relatórios acompanharem o novo valor.
 */
export async function updateAppointmentPaymentsAction(
  appointmentId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    let json: unknown;
    try {
      json = JSON.parse(String(formData.get("payments") ?? ""));
    } catch {
      return actionError(new Error("Pagamentos inválidos."));
    }
    const edits = editPaymentsSchema.parse(json);

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, companyId: user.companyId },
      include: { customer: true, payments: { orderBy: { createdAt: "asc" } } },
    });
    if (!appointment) return actionError(new Error("Agendamento não encontrado."));
    if (appointment.payments.length === 0) return actionError(new Error("Este agendamento ainda não tem pagamento registrado."));

    const ledger = await prisma.financialTransaction.findMany({
      where: { companyId: user.companyId, appointmentId, type: "INCOME", status: "PAID" },
      orderBy: { createdAt: "asc" },
    });
    const usedLedger = new Set<string>();
    const changes: { paymentId: string; from: { amount: number; paymentMethod: string }; to: { amount: number; paymentMethod: string } }[] = [];
    const ops = [];

    for (const edit of edits) {
      const payment = appointment.payments.find((p) => p.id === edit.id);
      if (!payment) return actionError(new Error("Pagamento não encontrado neste agendamento."));

      const sameDay = payment.paidAt.toISOString().slice(0, 10) === edit.paidAt;
      const paidAt = sameDay ? payment.paidAt : new Date(edit.paidAt);
      if (Number(payment.amount) === edit.amount && payment.paymentMethod === edit.paymentMethod && sameDay) continue;

      // Receita do pagamento: a que bate com os valores antigos; se não achar, a primeira ainda não usada.
      const entry =
        ledger.find((l) => !usedLedger.has(l.id) && Number(l.amount) === Number(payment.amount) && l.paymentMethod === payment.paymentMethod) ??
        ledger.find((l) => !usedLedger.has(l.id));
      if (entry) usedLedger.add(entry.id);

      ops.push(prisma.payment.update({ where: { id: payment.id }, data: { amount: edit.amount, paymentMethod: edit.paymentMethod, paidAt } }));
      if (entry) {
        ops.push(
          prisma.financialTransaction.update({
            where: { id: entry.id },
            data: { amount: edit.amount, paymentMethod: edit.paymentMethod, transactionDate: paidAt },
          })
        );
      } else {
        ops.push(
          prisma.financialTransaction.create({
            data: {
              companyId: user.companyId,
              type: "INCOME",
              category: "Serviços",
              description: `Pagamento — ${appointmentClientName(appointment)}`,
              amount: edit.amount,
              transactionDate: paidAt,
              paymentMethod: edit.paymentMethod,
              appointmentId,
              barberId: appointment.barberId,
              customerId: appointment.customerId ?? undefined,
              status: "PAID",
            },
          })
        );
      }
      changes.push({
        paymentId: payment.id,
        from: { amount: Number(payment.amount), paymentMethod: payment.paymentMethod },
        to: { amount: edit.amount, paymentMethod: edit.paymentMethod },
      });
    }

    if (ops.length === 0) return actionError(new Error("Nenhuma alteração para salvar."));
    await prisma.$transaction(ops);

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "payment_edited",
      entityType: "appointment",
      entityId: appointmentId,
      appointmentId,
      metadata: { changes },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/appointments");
  revalidatePath("/admin/financial");
  revalidatePath("/admin/dashboard");
  redirect("/admin/appointments");
}

const manualIncomeSchema = z.object({
  description: z.string().min(2, "Informe uma descrição."),
  category: z.string().min(1, "Informe a categoria."),
  amount: z.coerce.number().positive("Informe um valor válido."),
  transactionDate: z.string().min(1, "Informe a data."),
  paymentMethod: paymentMethodEnum,
  notes: z.string().optional().or(z.literal("")),
});

export async function createManualIncomeAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = manualIncomeSchema.parse({
      description: formData.get("description"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      transactionDate: formData.get("transactionDate"),
      paymentMethod: formData.get("paymentMethod"),
      notes: formData.get("notes"),
    });

    await prisma.financialTransaction.create({
      data: {
        companyId: user.companyId,
        type: "INCOME",
        category: data.category,
        description: data.description,
        amount: data.amount,
        transactionDate: new Date(data.transactionDate),
        paymentMethod: data.paymentMethod as PaymentMethod,
        status: "PAID",
        notes: data.notes || undefined,
      },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/financial");
  return actionSuccess();
}

const expenseSchema = z.object({
  description: z.string().min(2, "Informe uma descrição."),
  category: z.string().min(1, "Informe a categoria."),
  amount: z.coerce.number().positive("Informe um valor válido."),
  dueDate: z.string().min(1, "Informe o vencimento."),
  recurring: z.coerce.boolean().optional(),
  recurrenceType: z.enum(["NONE", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  notes: z.string().optional().or(z.literal("")),
});

export async function createExpenseAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = expenseSchema.parse({
      description: formData.get("description"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      dueDate: formData.get("dueDate"),
      recurring: formData.get("recurring") === "on",
      recurrenceType: formData.get("recurrenceType") || "NONE",
      notes: formData.get("notes"),
    });

    await prisma.expense.create({
      data: {
        companyId: user.companyId,
        description: data.description,
        category: data.category,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        status: "PENDING",
        recurring: !!data.recurring,
        recurrenceType: (data.recurring ? data.recurrenceType : "NONE") as RecurrenceType,
        notes: data.notes || undefined,
      },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/financial/expenses");
  return actionSuccess();
}

const markPaidSchema = z.object({
  paidDate: z.string().min(1, "Informe a data do pagamento."),
  paymentMethod: paymentMethodEnum,
});

export async function markExpensePaidAction(
  expenseId: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = markPaidSchema.parse({
      paidDate: formData.get("paidDate"),
      paymentMethod: formData.get("paymentMethod"),
    });

    const expense = await prisma.expense.findFirst({ where: { id: expenseId, companyId: user.companyId } });
    if (!expense) return actionError(new Error("Despesa não encontrada."));

    const paidDate = new Date(data.paidDate);

    await prisma.$transaction(async (tx) => {
      await tx.expense.updateMany({
        where: { id: expenseId, companyId: user.companyId },
        data: { status: "PAID", paidDate, paymentMethod: data.paymentMethod },
      });

      await tx.financialTransaction.create({
        data: {
          companyId: user.companyId,
          type: "EXPENSE",
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          transactionDate: paidDate,
          paymentMethod: data.paymentMethod,
          expenseId,
          status: "PAID",
        },
      });

      if (expense.recurring) {
        const next = nextRecurrenceDate(expense.dueDate, expense.recurrenceType);
        if (next) {
          await tx.expense.create({
            data: {
              companyId: user.companyId,
              description: expense.description,
              category: expense.category,
              amount: expense.amount,
              dueDate: next,
              status: "PENDING",
              recurring: true,
              recurrenceType: expense.recurrenceType,
              notes: expense.notes,
              parentExpenseId: expense.id,
            },
          });
        }
      }
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/financial/expenses");
  revalidatePath("/admin/financial");
  return actionSuccess();
}
