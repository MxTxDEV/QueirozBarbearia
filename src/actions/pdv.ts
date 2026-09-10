"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit";
import { toNumber } from "@/lib/serialize";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const saleItemSchema = z.object({
  type: z.enum(["SERVICE", "PRODUCT"]),
  id: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(50),
});

const createSaleSchema = z.object({
  barberId: z.string().min(1, "Selecione o barbeiro responsável."),
  customerId: z.string().min(1).optional(),
  appointmentId: z.string().min(1).optional(),
  items: z.array(saleItemSchema).min(1, "Adicione ao menos um item à venda."),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "OTHER"]),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

/**
 * Fecha uma venda do PDV — serviços e/ou produtos, desconto opcional,
 * atribuída sempre a um barbeiro (fonte do faturamento individual/metas).
 *
 * Segurança: nunca confia em nome/preço/total vindo do cliente. Cada
 * serviceId/productId é revalidado contra o catálogo da PRÓPRIA empresa
 * (nunca de outra) e o preço usado é sempre o do banco no momento do
 * fechamento — o total é sempre recalculado aqui, nunca aceito pronto.
 */
export async function createSaleAction(input: CreateSaleInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdminContext();
    const data = createSaleSchema.parse(input);

    const barber = await prisma.barber.findFirst({ where: { id: data.barberId, companyId: user.companyId } });
    if (!barber || !barber.active) return actionError(new Error("Barbeiro indisponível."));

    if (data.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: data.customerId, companyId: user.companyId }, select: { id: true } });
      if (!customer) return actionError(new Error("Cliente não encontrado."));
    }

    let appointment: { id: string; status: string; barberId: string } | null = null;
    if (data.appointmentId) {
      appointment = await prisma.appointment.findFirst({
        where: { id: data.appointmentId, companyId: user.companyId },
        select: { id: true, status: true, barberId: true },
      });
      if (!appointment) return actionError(new Error("Agendamento não encontrado."));
      if (appointment.status === "CANCELLED") return actionError(new Error("Este agendamento foi cancelado."));
      if (appointment.status === "COMPLETED") return actionError(new Error("Este agendamento já foi concluído e fechado."));
      if (appointment.barberId !== data.barberId) {
        return actionError(new Error("O barbeiro da venda precisa ser o mesmo do agendamento."));
      }
    }

    const serviceIds = data.items.filter((i) => i.type === "SERVICE").map((i) => i.id);
    const productIds = data.items.filter((i) => i.type === "PRODUCT").map((i) => i.id);

    const [services, products] = await Promise.all([
      serviceIds.length
        ? prisma.service.findMany({ where: { id: { in: serviceIds }, companyId: user.companyId, active: true } })
        : Promise.resolve([]),
      productIds.length
        ? prisma.product.findMany({ where: { id: { in: productIds }, companyId: user.companyId, active: true } })
        : Promise.resolve([]),
    ]);

    if (services.length !== serviceIds.length || products.length !== productIds.length) {
      return actionError(new Error("Um ou mais itens não estão mais disponíveis. Atualize a página e tente novamente."));
    }

    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lineItems = data.items.map((item) => {
      const source = item.type === "SERVICE" ? serviceMap.get(item.id)! : productMap.get(item.id)!;
      const unitPrice = toNumber(source.price);
      return {
        type: item.type,
        serviceId: item.type === "SERVICE" ? item.id : null,
        productId: item.type === "PRODUCT" ? item.id : null,
        name: source.name,
        unitPrice,
        quantity: item.quantity,
        totalPrice: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    });

    const subtotal = Math.round(lineItems.reduce((sum, i) => sum + i.totalPrice, 0) * 100) / 100;
    if (data.discount > subtotal) {
      return actionError(new Error("O desconto não pode ser maior que o subtotal."));
    }
    const total = Math.round((subtotal - data.discount) * 100) / 100;
    const soldAt = new Date();

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          companyId: user.companyId,
          barberId: data.barberId,
          customerId: data.customerId,
          appointmentId: data.appointmentId,
          createdByUserId: user.id,
          subtotal,
          discount: data.discount,
          total,
          paymentMethod: data.paymentMethod,
          status: "COMPLETED",
          soldAt,
          items: { create: lineItems },
        },
      });

      if (data.customerId) {
        await tx.payment.create({
          data: {
            companyId: user.companyId,
            saleId: created.id,
            appointmentId: data.appointmentId,
            customerId: data.customerId,
            amount: total,
            paymentMethod: data.paymentMethod,
            paidAt: soldAt,
          },
        });
      }

      await tx.financialTransaction.create({
        data: {
          companyId: user.companyId,
          type: "INCOME",
          category: "PDV",
          description: `Venda PDV — ${barber.name}`,
          amount: total,
          transactionDate: soldAt,
          paymentMethod: data.paymentMethod,
          saleId: created.id,
          barberId: data.barberId,
          customerId: data.customerId,
          appointmentId: data.appointmentId,
          status: "PAID",
        },
      });

      if (data.appointmentId) {
        await tx.appointment.update({
          where: { id: data.appointmentId },
          data: { status: "COMPLETED", completedAt: soldAt },
        });
      }

      return created;
    });

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "sale_completed",
      entityType: "sale",
      entityId: sale.id,
      appointmentId: data.appointmentId,
      metadata: { barberId: data.barberId, total, discount: data.discount, paymentMethod: data.paymentMethod, itemCount: lineItems.length },
    });

    revalidatePath("/admin/pdv");
    revalidatePath("/admin/appointments");
    revalidatePath("/admin/financial");
    revalidatePath("/admin/goals");
    revalidatePath("/admin/dashboard");

    return actionSuccess({ id: sale.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return actionError(new Error("Esse agendamento já possui uma venda registrada."));
    }
    return actionError(error);
  }
}

/**
 * Cancela uma venda: some do faturamento (livro-razão e pagamento são
 * removidos, já que representam dinheiro que não entrou de fato), mas a
 * venda em si permanece com status CANCELLED — histórico pro fechamento de
 * caixa ("vendas / cancelamentos do dia") nunca é apagado.
 */
export async function cancelSaleAction(saleId: string): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const sale = await prisma.sale.findFirst({ where: { id: saleId, companyId: user.companyId } });
    if (!sale) return actionError(new Error("Venda não encontrada."));
    if (sale.status === "CANCELLED") return actionError(new Error("Essa venda já foi cancelada."));

    await prisma.$transaction([
      prisma.financialTransaction.deleteMany({ where: { saleId, companyId: user.companyId } }),
      prisma.payment.deleteMany({ where: { saleId, companyId: user.companyId } }),
      prisma.sale.update({ where: { id: saleId }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
    ]);

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "sale_cancelled",
      entityType: "sale",
      entityId: saleId,
      metadata: { total: toNumber(sale.total) },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/pdv");
  revalidatePath("/admin/financial");
  revalidatePath("/admin/goals");
  revalidatePath("/admin/dashboard");
  return actionSuccess();
}
