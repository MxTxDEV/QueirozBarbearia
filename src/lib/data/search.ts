import "server-only";
import { prisma } from "@/lib/prisma";

export type SearchResult = {
  type: "customer" | "service" | "barber";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const RESULT_LIMIT = 5;

/**
 * Busca global do painel — usada pelo command palette (Ctrl/Cmd+K). Sempre
 * escopada por companyId, nunca aceita esse parâmetro do cliente. Barbeiros
 * não veem a lista de outros barbeiros (mesma regra já aplicada no resto do
 * painel: login de barbeiro só vê o próprio contexto).
 */
export async function globalSearch(companyId: string, query: string, isAdmin: boolean): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const phoneDigits = q.replace(/\D/g, "");

  const [customers, services, barbers] = await Promise.all([
    prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          ...(phoneDigits ? [{ whatsapp: { contains: phoneDigits } }] : []),
        ],
      },
      take: RESULT_LIMIT,
      orderBy: { fullName: "asc" },
    }),
    prisma.service.findMany({
      where: { companyId, name: { contains: q, mode: "insensitive" } },
      take: RESULT_LIMIT,
      orderBy: { name: "asc" },
    }),
    isAdmin
      ? prisma.barber.findMany({
          where: { companyId, name: { contains: q, mode: "insensitive" } },
          take: RESULT_LIMIT,
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...customers.map((c): SearchResult => ({
      type: "customer",
      id: c.id,
      title: c.fullName,
      subtitle: c.whatsapp,
      href: `/admin/customers/${c.id}`,
    })),
    ...services.map((s): SearchResult => ({
      type: "service",
      id: s.id,
      title: s.name,
      subtitle: "Serviço",
      href: `/admin/services/${s.id}/edit`,
    })),
    ...barbers.map((b): SearchResult => ({
      type: "barber",
      id: b.id,
      title: b.name,
      subtitle: "Barbeiro",
      href: `/admin/barbers/${b.id}`,
    })),
  ];
}
