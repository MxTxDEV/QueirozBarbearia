import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/serialize";

/** Métricas globais da plataforma — nunca chamado fora do contexto SUPERADMIN. */
export async function getPlatformOverview() {
  const [
    totalCompanies,
    activeCompanies,
    suspendedCompanies,
    blockedCompanies,
    totalUsers,
    totalCustomers,
    totalAppointments,
    revenueAgg,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.company.count({ where: { status: "SUSPENDED" } }),
    prisma.company.count({ where: { status: "BLOCKED" } }),
    prisma.user.count({ where: { role: { not: "SUPERADMIN" } } }),
    prisma.customer.count(),
    prisma.appointment.count(),
    prisma.financialTransaction.aggregate({ where: { type: "INCOME" }, _sum: { amount: true } }),
  ]);

  return {
    totalCompanies,
    activeCompanies,
    suspendedCompanies,
    blockedCompanies,
    totalUsers,
    totalCustomers,
    totalAppointments,
    totalRevenue: toNumber(revenueAgg._sum.amount),
  };
}

export async function listCompanies(search?: string) {
  const companies = await prisma.company.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, customers: true, appointments: true } },
    },
  });
  return companies;
}

export async function getCompanyDetail(id: string) {
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      _count: { select: { customers: true, barbers: true, appointments: true } },
    },
  });
  if (!company) return null;

  const revenueAgg = await prisma.financialTransaction.aggregate({
    where: { companyId: id, type: "INCOME" },
    _sum: { amount: true },
  });

  return { company, totalRevenue: toNumber(revenueAgg._sum.amount) };
}

export async function listAuditLog(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { name: true, email: true } },
      company: { select: { name: true, slug: true } },
    },
  });
}

export async function listAllUsers(search?: string) {
  return prisma.user.findMany({
    where: {
      role: { not: "SUPERADMIN" },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { company: { select: { name: true, slug: true } } },
  });
}
