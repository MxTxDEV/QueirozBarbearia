import "server-only";
import type { Prisma } from "@prisma/client";
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
  minServicePrice: number | null;
  distanceKm: number | null;
};

export type PublicCompanyFilters = {
  page?: number;
  /** Busca por nome, case-insensitive (substring). */
  query?: string;
  /** Só empresas com ao menos um serviço ativo com preço até este valor. */
  maxPrice?: number;
  /** Localização do cliente — quando informada, ordena por distância (mais perto primeiro) em vez de por nome. */
  near?: { lat: number; lng: number } | null;
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

/** Menor preço entre os serviços ativos de cada empresa, numa única query agregada. */
async function minPriceByCompany(companyIds: string[]) {
  const result = new Map<string, number>();
  if (companyIds.length === 0) return result;

  const rows = await prisma.service.groupBy({
    by: ["companyId"],
    where: { companyId: { in: companyIds }, active: true },
    _min: { price: true },
  });
  for (const row of rows) {
    if (row._min.price != null) result.set(row.companyId, Number(row._min.price));
  }
  return result;
}

/** Distância em km entre duas coordenadas (fórmula de Haversine). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  coverImageUrl: true,
  neighborhood: true,
  city: true,
  state: true,
  latitude: true,
  longitude: true,
  _count: { select: { services: { where: { active: true } } } },
} as const;

/**
 * Lista paginada para /agendar, com busca por nome, filtro de preço máximo e,
 * opcionalmente, ordenação por proximidade da localização do cliente.
 *
 * Sem `near`: paginação feita direto no banco (skip/take), ordenada por nome.
 * Com `near`: como o schema não tem suporte geoespacial (sem PostGIS), busca
 * todas as empresas que batem com os demais filtros, calcula a distância em
 * memória e pagina depois de ordenar — assume um volume de empresas
 * cadastradas na plataforma (não de clientes), então não é um problema de
 * escala aqui.
 */
export async function listPublicCompanies(filters: PublicCompanyFilters = {}): Promise<{
  companies: PublicCompanyCard[];
  total: number;
  totalPages: number;
  page: number;
}> {
  const safePage = Math.max(1, Math.floor(filters.page ?? 1) || 1);
  const name = filters.query?.trim();

  const where = {
    ...PUBLIC_WHERE,
    ...(name ? { name: { contains: name, mode: "insensitive" as const } } : {}),
    ...(filters.maxPrice != null && Number.isFinite(filters.maxPrice)
      ? { services: { some: { active: true, price: { lte: filters.maxPrice } } } }
      : {}),
  };

  type CardRow = Prisma.CompanyGetPayload<{ select: typeof CARD_SELECT }> & { distanceKm: number | null };

  let total: number;
  let rows: CardRow[];

  if (filters.near) {
    const all = await prisma.company.findMany({ where, select: CARD_SELECT, orderBy: { name: "asc" } });
    total = all.length;
    const withDistance = all.map((c) => ({
      ...c,
      distanceKm: c.latitude != null && c.longitude != null ? haversineKm(filters.near!.lat, filters.near!.lng, c.latitude, c.longitude) : null,
    }));
    withDistance.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
    rows = withDistance.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  } else {
    const [count, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        select: CARD_SELECT,
        orderBy: { name: "asc" },
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    total = count;
    rows = companies.map((c) => ({ ...c, distanceKm: null }));
  }

  const companyIds = rows.map((c) => c.id);
  const [hoursByCompany, priceByCompany] = await Promise.all([todayHoursByCompany(companyIds), minPriceByCompany(companyIds)]);

  return {
    companies: rows.map((c) => ({
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
      minServicePrice: priceByCompany.get(c.id) ?? null,
      distanceKm: c.distanceKm,
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
  latitude: number | null;
  longitude: number | null;
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
      latitude: true,
      longitude: true,
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
      latitude: company.latitude,
      longitude: company.longitude,
      serviceCount: company._count.services,
      barberCount: company._count.barbers,
      todayHoursLabel: todayHours?.label ?? null,
      isOpenNow: todayHours?.isOpenNow ?? false,
    },
  };
}
