import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";
import { periodToDates, type PeriodFilter } from "@/lib/data/financial";
import { bucketKey, bucketLabel, deltaPercent, previousPeriodRange, type BucketUnit } from "@/lib/barber-financial-helpers";

/**
 * Faturamento por barbeiro. A receita é atribuída ao barbeiro gravado no próprio lançamento
 * (`barberId`) e, quando ele não está preenchido (lançamentos antigos, ou de antes dessa regra),
 * ao barbeiro do agendamento ou da venda de origem — assim o histórico não "some" do painel dele.
 * Receita manual sem agendamento/venda de origem fica em "sem barbeiro".
 */

/** Quantos lançamentos a lista do painel traz de uma vez (os totais sempre consideram todos). */
const MAX_LISTED = 300;

function dateRange(period: PeriodFilter) {
  const { from, to } = periodToDates(period);
  return from && to ? { transactionDate: { gte: from, lt: to } } : {};
}

/** Receitas do barbeiro: lançamento dele, ou sem barbeiro mas de agendamento/venda dele. */
function barberIncomeWhere(companyId: string, barberId: string, period: PeriodFilter): Prisma.FinancialTransactionWhereInput {
  return {
    companyId,
    type: "INCOME",
    ...dateRange(period),
    OR: [{ barberId }, { barberId: null, appointment: { barberId } }, { barberId: null, sale: { barberId } }],
  };
}

export type BarberRevenueRow = { barberId: string; name: string; income: number; count: number };

/** Receita de cada barbeiro no período + o que não é de nenhum barbeiro, pra conferir com o total da barbearia. */
export async function getBarbersRevenue(companyId: string, period: PeriodFilter) {
  const [barbers, rows] = await Promise.all([
    prisma.barber.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.financialTransaction.findMany({
      where: { companyId, type: "INCOME", ...dateRange(period) },
      select: { amount: true, barberId: true, appointment: { select: { barberId: true } }, sale: { select: { barberId: true } } },
    }),
  ]);

  const byBarber = new Map<string, { income: number; count: number }>();
  let unassigned = 0;
  let total = 0;
  for (const row of rows) {
    const amount = toNumber(row.amount);
    total += amount;
    const owner = row.barberId ?? row.appointment?.barberId ?? row.sale?.barberId ?? null;
    if (!owner) {
      unassigned += amount;
      continue;
    }
    const entry = byBarber.get(owner) ?? { income: 0, count: 0 };
    entry.income += amount;
    entry.count += 1;
    byBarber.set(owner, entry);
  }

  const list: BarberRevenueRow[] = barbers
    // Barbeiro inativo some do painel — a não ser que tenha faturado no período.
    .filter((b) => b.active || (byBarber.get(b.id)?.income ?? 0) > 0)
    .map((b) => ({ barberId: b.id, name: b.name, income: byBarber.get(b.id)?.income ?? 0, count: byBarber.get(b.id)?.count ?? 0 }));

  return { total, unassigned, barbers: list };
}

/** Painel financeiro de UM barbeiro (null se ele não é desta empresa). */
export async function getBarberFinancials(companyId: string, barberId: string, period: PeriodFilter) {
  const barber = await prisma.barber.findFirst({ where: { id: barberId, companyId }, select: { id: true, name: true, active: true } });
  if (!barber) return null;

  const [rows, company] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: barberIncomeWhere(companyId, barberId, period),
      orderBy: { transactionDate: "desc" },
      select: {
        id: true,
        description: true,
        category: true,
        amount: true,
        paymentMethod: true,
        transactionDate: true,
        appointmentId: true,
        saleId: true,
        barberId: true,
        customer: { select: { fullName: true } },
      },
    }),
    getBarbersRevenue(companyId, period),
  ]);

  // Período anterior (mesmo tamanho) pra mostrar se o barbeiro está faturando mais ou menos.
  const { from, to } = periodToDates(period);
  const prevRange = from && to ? previousPeriodRange(period, from, to) : null;
  const previousIncome = prevRange
    ? toNumber(
        (
          await prisma.financialTransaction.aggregate({
            where: {
              companyId,
              type: "INCOME",
              transactionDate: { gte: prevRange.from, lt: prevRange.to },
              OR: [{ barberId }, { barberId: null, appointment: { barberId } }, { barberId: null, sale: { barberId } }],
            },
            _sum: { amount: true },
          })
        )._sum.amount
      )
    : null;

  const income = rows.reduce((sum, r) => sum + toNumber(r.amount), 0);
  const count = rows.length;

  const byCategory = new Map<string, number>();
  const byMethod = new Map<string, number>();
  const unit: BucketUnit = period === "year" || period === "all" ? "month" : "day";
  const byBucket = new Map<string, number>();
  for (const row of rows) {
    const amount = toNumber(row.amount);
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + amount);
    const method = row.paymentMethod ?? "OTHER";
    byMethod.set(method, (byMethod.get(method) ?? 0) + amount);
    const key = bucketKey(row.transactionDate, unit);
    byBucket.set(key, (byBucket.get(key) ?? 0) + amount);
  }

  const series = [...byBucket.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ key, label: bucketLabel(key, unit), value }));

  return {
    barber,
    income,
    count,
    averageTicket: count > 0 ? income / count : 0,
    shareOfTotal: company.total > 0 ? (income / company.total) * 100 : 0,
    companyTotal: company.total,
    byCategory: [...byCategory.entries()].map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value),
    byMethod: [...byMethod.entries()].map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value),
    series,
    unit,
    previousIncome,
    deltaPct: previousIncome === null ? null : deltaPercent(income, previousIncome),
    /** Todos os barbeiros ativos — pro atalho de trocar de barbeiro e pro seletor de "barbeiro" ao editar. */
    barbers: company.barbers.map((b) => ({ id: b.barberId, name: b.name, income: b.income })),
    /** Serializável (vai pra um componente cliente): sem Decimal nem Date. */
    transactions: rows.slice(0, MAX_LISTED).map((r) => ({
      id: r.id,
      description: r.description,
      category: r.category,
      amount: toNumber(r.amount),
      paymentMethod: r.paymentMethod,
      date: r.transactionDate.toISOString().slice(0, 10),
      origin: (r.saleId ? "sale" : r.appointmentId ? "appointment" : "manual") as "sale" | "appointment" | "manual",
      barberId: r.barberId,
      customerName: r.customer?.fullName ?? null,
    })),
    totalTransactions: count,
  };
}
