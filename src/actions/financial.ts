"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit";
import { nextRecurrenceDate } from "@/lib/recurrence";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";
import type { PaymentMethod, RecurrenceType } from "@prisma/client";

const paymentMethodEnum = z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "OTHER"]);

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Informe um valor válido."),
  paymentMethod: paymentMethodEnum,
  paidAt: z.string().min(1, "Informe a data do pagamento."),
});

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

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, companyId: user.companyId },
      include: { customer: true },
    });
    if (!appointment) return actionError(new Error("Agendamento não encontrado."));
    if (appointment.status !== "COMPLETED") {
      return actionError(new Error("Só é possível registrar pagamento de agendamentos concluídos."));
    }

    const paidAt = new Date(data.paidAt);

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          companyId: user.companyId,
          appointmentId,
          customerId: appointment.customerId,
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
          description: `Pagamento — ${appointment.customer.fullName}`,
          amount: data.amount,
          transactionDate: paidAt,
          paymentMethod: data.paymentMethod,
          appointmentId,
          customerId: appointment.customerId,
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
      metadata: { amount: data.amount, paymentMethod: data.paymentMethod },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/appointments");
  revalidatePath("/admin/financial");
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
