"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { requireAdminContext } from "@/lib/require-admin";
import { getAvailableSlots } from "@/lib/availability";

async function computeSlots(barberId: string, companyId: string, dateStr: string, totalDurationMinutes: number) {
  const barber = await prisma.barber.findFirst({ where: { id: barberId, companyId }, select: { id: true } });
  if (!barber) return [];

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const slots = await getAvailableSlots({ barberId, date, totalDurationMinutes });
  return slots.map((s) => ({ iso: s.start.toISOString(), label: s.label }));
}

/**
 * Usada pelo portal do cliente (booking-wizard.tsx). Só retorna horários de
 * um barbeiro da mesma empresa do CLIENTE autenticado — nunca de outra.
 */
export async function getAvailableSlotsAction(barberId: string, dateStr: string, totalDurationMinutes: number) {
  const customer = await getCurrentCustomer();
  if (!customer) return [];
  return computeSlots(barberId, customer.companyId, dateStr, totalDurationMinutes);
}

/**
 * Usada pelo painel administrativo (admin-booking-form.tsx), onde o
 * operador logado é um User (ADMIN/BARBER), não um Customer — por isso
 * precisa da própria action, gated por requireAdminContext(). Reutilizar
 * getAvailableSlotsAction aqui (gated por getCurrentCustomer()) sempre
 * retornava lista vazia pra qualquer admin, já que ele nunca tem sessão de
 * cliente: esse era o bug relatado de "nenhum horário disponível em
 * nenhuma data" ao agendar pelo painel.
 */
export async function getAvailableSlotsForAdminAction(barberId: string, dateStr: string, totalDurationMinutes: number) {
  const user = await requireAdminContext();
  return computeSlots(barberId, user.companyId, dateStr, totalDurationMinutes);
}
