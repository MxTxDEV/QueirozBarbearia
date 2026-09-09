import "server-only";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 24;

/**
 * Filtro base de toda visibilidade pública: só empresas ativas E com
 * agendamento online habilitado aparecem em /agendar ou respondem em
 * /agendar/{slug} — nunca confia em nada vindo do cliente para decidir isso,
 * é sempre resolvido aqui a partir do banco.
 */
const PUBLIC_WHERE = { status: "ACTIVE" as const, onlineBookingEnabled: true };

export type PublicCompanyCard = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  serviceCount: number;
  todayHoursLabel: string | null;
  isOpenNow: boolean;
};

function currentWeekdayAndTime() {
  const now = new Date();
  // Mesma convenção de horário usada no resto do sistema (src/lib/availability.ts,
  // BarberWorkingHour): getUTCDay()/HH:MM em UTC, sem conversão de fuso — os
  // valores "09:00"/"19:00" cadastrados já usam essa mesma referência.
  return { weekday: now.getUTCDay(), hhmm: now.toISOString().slice(11, 16) };
}

/** Agrega o expediente de hoje (menor início, maior fim entre os barbeiros ativos) para um conjunto de empresas, numa única query. */
async function todayHoursByCompany(companyIds: string[]) {
  const { weekday, hhmm } = currentWeekdayAndTime();
  const rows = await prisma.barberWorkingHour.findMany({
    where: { weekday, barber: { companyId: { in: companyIds }, active: true } },
    select: { startTime: true, endTime: true, barber: { select: { companyId: true } } },
  });

  const byCompany = new Map<string, { start: string; end: string }>();
  for (const row of rows) {
    const companyId = row.barber.companyId;
    const current = byCompany.get(companyId);
    if (!current) {
      byCompany.set(companyId, { start: row.startTime, end: row.endTime });
    } else {
      if (row.startTime < current.start) current.start = row.startTime;
      if (row.endTime > current.end) current.end = row.endTime;
    }
  }

  const result = new Map<string, { label: string | null; isOpenNow: boolean }>();
  for (const companyId of companyIds) {
    const hours = byCompany.get(companyId);
    if (!hours) {
      result.set(companyId, { label: null, isOpenNow: false });
      continue;
    }
    result.set(companyId, {
      label: `${hours.start}–${hours.end}`,
      isOpenNow: hhmm >= hours.start && hhmm < hours.end,
    });
  }
  return result;
}

/**
 * Lista paginada para /agendar. Query enxuta: só os campos que os cards
 * precisam, contagem de serviços via _count (sem trazer os serviços
 * inteiros), e uma única query extra para o expediente de hoje — nunca uma
 * consulta por empresa.
 */
export async function listPublicCompanies(page = 1): Promise<{
  companies: PublicCompanyCard[];
  total: number;
  totalPages: number;
  page: number;
}> {
  const safePage = Math.max(1, Math.floor(page) || 1);

  const [total, companies] = await Promise.all([
    prisma.company.count({ where: PUBLIC_WHERE }),
    prisma.company.findMany({
      where: PUBLIC_WHERE,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        coverImageUrl: true,
        neighborhood: true,
        city: true,
        state: true,
        _count: { select: { services: { where: { active: true } } } },
      },
      orderBy: { name: "asc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const hoursByCompany = await todayHoursByCompany(companies.map((c) => c.id));

  return {
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      logoUrl: c.logoUrl,
      coverImageUrl: c.coverImageUrl,
      neighborhood: c.neighborhood,
      city: c.city,
      state: c.state,
      serviceCount: c._count.services,
      todayHoursLabel: hoursByCompany.get(c.id)?.label ?? null,
      isOpenNow: hoursByCompany.get(c.id)?.isOpenNow ?? false,
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    page: safePage,
  };
}

export type PublicCompanyProfile = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  serviceCount: number;
  barberCount: number;
  todayHoursLabel: string | null;
  isOpenNow: boolean;
};

export type PublicCompanyResolution =
  | { kind: "available"; company: PublicCompanyProfile }
  | { kind: "not_found" }
  | { kind: "unavailable"; name: string; reason: "SUSPENDED" | "BLOCKED" | "BOOKING_DISABLED" };

/**
 * Resolve o slug pra uma empresa pública. Nunca confia em nada vindo do
 * cliente além do próprio slug da URL — status/onlineBookingEnabled são
 * sempre lidos do banco. Distingue "não existe" (404) de "existe mas está
 * indisponível" (tela amigável, não 404) — regra do item 13 do pedido.
 */
export async function resolvePublicCompany(slug: string): Promise<PublicCompanyResolution> {
  const company = await prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      coverImageUrl: true,
      address: true,
      neighborhood: true,
      city: true,
      state: true,
      status: true,
      onlineBookingEnabled: true,
      _count: { select: { services: { where: { active: true } }, barbers: { where: { active: true } } } },
    },
  });
  if (!company) return { kind: "not_found" };

  if (company.status === "SUSPENDED") return { kind: "unavailable", name: company.name, reason: "SUSPENDED" };
  if (company.status === "BLOCKED") return { kind: "unavailable", name: company.name, reason: "BLOCKED" };
  if (!company.onlineBookingEnabled) return { kind: "unavailable", name: company.name, reason: "BOOKING_DISABLED" };

  const hours = await todayHoursByCompany([company.id]);
  const todayHours = hours.get(company.id);

  return {
    kind: "available",
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logoUrl: company.logoUrl,
      coverImageUrl: company.coverImageUrl,
      address: company.address,
      neighborhood: company.neighborhood,
      city: company.city,
      state: company.state,
      serviceCount: company._count.services,
      barberCount: company._count.barbers,
      todayHoursLabel: todayHours?.label ?? null,
      isOpenNow: todayHours?.isOpenNow ?? false,
    },
  };
}
