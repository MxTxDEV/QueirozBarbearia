"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit";
import { toNumber } from "@/lib/serialize";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

/**
 * Correções de receita feitas no painel financeiro de cada barbeiro: lançar, editar e excluir.
 * Só ADMIN. Receita que nasceu de um pagamento de atendimento ou de uma venda do PDV mexe também
 * no registro de origem (Payment/Sale) — senão relatórios que leem o pagamento e os que leem o
 * livro-razão passariam a discordar.
 */

const paymentMethodEnum = z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "OTHER"]);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const fields = {
  description: z.string().trim().min(2, "Informe uma descrição.").max(200, "Descrição muito longa."),
  category: z.string().trim().min(1, "Informe a categoria.").max(60),
  amount: z.coerce.number().positive("Informe um valor maior que zero.").max(1_000_000, "Valor muito alto."),
  paymentMethod: paymentMethodEnum,
  date: dateString,
};

const createSchema = z.object({
  ...fields,
  barberId: z.string().min(1, "Selecione o barbeiro."),
  notes: z.string().trim().max(500).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  ...fields,
  /** Vazio = sem barbeiro. */
  barberId: z.string().optional(),
});

// Entrada "crua" (strings vindas de formulário): o zod valida de verdade lá dentro.
type RawFields = { description: string; category: string; amount: string | number; paymentMethod: string; date: string };
export type CreateBarberIncomeInput = RawFields & { barberId: string; notes?: string };
export type UpdateIncomeInput = RawFields & { id: string; barberId?: string };

function revalidateFinancial() {
  revalidatePath("/admin/financial", "layout");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/goals");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/pdv");
}

/** "YYYY-MM-DD" de um instante gravado como relógio de parede em UTC. */
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/** Lança uma receita manual já atribuída a um barbeiro (ex: um serviço feito fora do sistema). */
export async function createBarberIncomeAction(input: CreateBarberIncomeInput): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const data = createSchema.parse(input);

    const barber = await prisma.barber.findFirst({ where: { id: data.barberId, companyId: user.companyId } });
    if (!barber) return actionError(new Error("Barbeiro não encontrado."));

    const created = await prisma.financialTransaction.create({
      data: {
        companyId: user.companyId,
        type: "INCOME",
        category: data.category,
        description: data.description,
        amount: data.amount,
        transactionDate: new Date(data.date),
        paymentMethod: data.paymentMethod as PaymentMethod,
        barberId: barber.id,
        status: "PAID",
        notes: data.notes || undefined,
      },
    });
    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "income_created",
      entityType: "financial_transaction",
      entityId: created.id,
      metadata: { barberId: barber.id, amount: data.amount, category: data.category },
    });

    revalidateFinancial();
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

/** Edita uma receita: valor, descrição, categoria, forma de pagamento, data e barbeiro. */
export async function updateIncomeAction(input: UpdateIncomeInput): Promise<ActionResult> {
  try {
    const user = await requireAdminOnly();
    const data = updateSchema.parse(input);

    const tx = await prisma.financialTransaction.findFirst({ where: { id: data.id, companyId: user.companyId, type: "INCOME" } });
    if (!tx) return actionError(new Error("Receita não encontrada."));

    let barberId: string | null = null;
    if (data.barberId) {
      const barber = await prisma.barber.findFirst({ where: { id: data.barberId, companyId: user.companyId } });
      if (!barber) return actionError(new Error("Barbeiro não encontrado."));
      barberId = barber.id;
    }

    // Só troca a data se o usuário mexeu nela — a venda do PDV guarda a hora exata e não deve perdê-la.
    const transactionDate = data.date === dayOf(tx.transactionDate) ? tx.transactionDate : new Date(data.date);
    const amountChanged = toNumber(tx.amount) !== data.amount;

    await prisma.$transaction(async (db) => {
      await db.financialTransaction.update({
        where: { id: tx.id },
        data: {
          description: data.description,
          category: data.category,
          amount: data.amount,
          transactionDate,
          paymentMethod: data.paymentMethod as PaymentMethod,
          barberId,
        },
      });

      // Pagamento de atendimento / venda do PDV: o registro de origem acompanha.
      const paymentWhere: Prisma.PaymentWhereInput | null = tx.saleId
        ? { saleId: tx.saleId, companyId: user.companyId }
        : tx.appointmentId
          ? { appointmentId: tx.appointmentId, saleId: null, companyId: user.companyId }
          : null;
      if (paymentWhere) {
        await db.payment.updateMany({
          where: paymentWhere,
          data: { amount: data.amount, paymentMethod: data.paymentMethod as PaymentMethod, paidAt: transactionDate },
        });
      }
      if (tx.saleId) {
        const sale = await db.sale.findFirst({ where: { id: tx.saleId, companyId: user.companyId } });
        if (sale) {
          // O total da venda passa a ser o valor corrigido; o desconto absorve a diferença (nunca negativo).
          const discount = Math.max(0, toNumber(sale.subtotal) - data.amount);
          await db.sale.update({
            where: { id: sale.id },
            data: { total: data.amount, discount, paymentMethod: data.paymentMethod as PaymentMethod },
          });
        }
      }
    });

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "income_updated",
      entityType: "financial_transaction",
      entityId: tx.id,
      appointmentId: tx.appointmentId ?? undefined,
      metadata: {
        amount: { from: toNumber(tx.amount), to: data.amount },
        amountChanged,
        barberId: { from: tx.barberId, to: barberId },
        paymentMethod: { from: tx.paymentMethod, to: data.paymentMethod },
      },
    });

    revalidateFinancial();
    return actionSuccess();
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Exclui uma receita.
 * - Pagamento de atendimento: apaga o lançamento e o pagamento; o atendimento volta a aparecer como "sem pagamento".
 * - Venda do PDV: cancela a venda (ela continua no histórico do caixa como cancelada), como no PDV.
 * - Receita manual: apaga o lançamento.
 */
export async function deleteIncomeAction(id: string): Promise<ActionResult<{ kind: "appointment" | "sale" | "manual" }>> {
  try {
    const user = await requireAdminOnly();
    const tx = await prisma.financialTransaction.findFirst({ where: { id, companyId: user.companyId, type: "INCOME" } });
    if (!tx) return actionError(new Error("Receita não encontrada."));

    const kind = tx.saleId ? "sale" : tx.appointmentId ? "appointment" : "manual";

    await prisma.$transaction(async (db) => {
      if (tx.saleId) {
        await db.financialTransaction.deleteMany({ where: { saleId: tx.saleId, companyId: user.companyId } });
        await db.payment.deleteMany({ where: { saleId: tx.saleId, companyId: user.companyId } });
        await db.sale.updateMany({
          where: { id: tx.saleId, companyId: user.companyId, status: { not: "CANCELLED" } },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
      } else {
        await db.financialTransaction.delete({ where: { id: tx.id } });
        if (tx.appointmentId) {
          await db.payment.deleteMany({ where: { appointmentId: tx.appointmentId, saleId: null, companyId: user.companyId } });
        }
      }
    });

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "income_deleted",
      entityType: "financial_transaction",
      entityId: tx.id,
      appointmentId: tx.appointmentId ?? undefined,
      metadata: { kind, amount: toNumber(tx.amount), description: tx.description, barberId: tx.barberId },
    });

    revalidateFinancial();
    return actionSuccess({ kind });
  } catch (error) {
    return actionError(error);
  }
}
