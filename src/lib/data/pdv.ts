import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";

/** Dados pra montar a tela do PDV: catálogo ativo + agendamentos de hoje que ainda podem virar uma venda. */
export async function getPdvBootstrapData(companyId: string, barberId?: string) {
  const today = new Date();
  const dateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const [barbers, services, products, todayAppointments] = await Promise.all([
    prisma.barber.findMany({ where: { companyId, active: true, ...(barberId ? { id: barberId } : {}) }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
    prisma.appointment.findMany({
      where: {
        companyId,
        appointmentDate: dateOnly,
        status: { in: ["PENDING", "CONFIRMED"] },
        ...(barberId ? { barberId } : {}),
      },
      orderBy: { startTime: "asc" },
      include: { customer: true, barber: true, services: true },
    }),
  ]);

  return {
    barbers,
    services: services.map((s) => ({ id: s.id, name: s.name, price: toNumber(s.price), durationMinutes: s.durationMinutes })),
    products: products.map((p) => ({ id: p.id, name: p.name, price: toNumber(p.price) })),
    todayAppointments: todayAppointments.map((a) => ({
      id: a.id,
      customerId: a.customerId,
      customerName: a.customer.fullName,
      barberId: a.barberId,
      barberName: a.barber.name,
      startTime: a.startTime.toISOString(),
      serviceIds: a.services.map((s) => s.serviceId),
      serviceNames: a.services.map((s) => s.serviceName).join(", "),
    })),
  };
}

/** Resumo do dia pro fechamento de caixa: totais por forma de pagamento, faturamento e cancelamentos. */
export async function getTodaySalesSummary(companyId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const [completed, cancelled] = await Promise.all([
    prisma.sale.findMany({
      where: { companyId, status: "COMPLETED", soldAt: { gte: start, lt: end } },
      select: { total: true, discount: true, paymentMethod: true },
    }),
    prisma.sale.count({ where: { companyId, status: "CANCELLED", cancelledAt: { gte: start, lt: end } } }),
  ]);

  const byMethod = new Map<string, number>();
  let totalRevenue = 0;
  let totalDiscount = 0;
  for (const sale of completed) {
    const total = toNumber(sale.total);
    totalRevenue += total;
    totalDiscount += toNumber(sale.discount);
    byMethod.set(sale.paymentMethod, (byMethod.get(sale.paymentMethod) ?? 0) + total);
  }

  return {
    salesCount: completed.length,
    cancelledCount: cancelled,
    totalRevenue,
    totalDiscount,
    byMethod: Object.fromEntries(byMethod),
  };
}

/** Últimas vendas do dia, mais recente primeiro — pra lista/cancelamento na própria tela do PDV. */
export async function listTodaySales(companyId: string, barberId?: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const sales = await prisma.sale.findMany({
    where: { companyId, soldAt: { gte: start, lt: end }, ...(barberId ? { barberId } : {}) },
    orderBy: { soldAt: "desc" },
    include: { barber: true, customer: true, items: true },
  });

  return sales.map((s) => ({
    id: s.id,
    barberName: s.barber.name,
    customerName: s.customer?.fullName ?? null,
    itemsLabel: s.items.map((i) => (i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name)).join(", "),
    total: toNumber(s.total),
    discount: toNumber(s.discount),
    paymentMethod: s.paymentMethod,
    status: s.status,
    soldAt: s.soldAt.toISOString(),
  }));
}
