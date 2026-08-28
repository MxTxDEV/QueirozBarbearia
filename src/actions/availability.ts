"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getAvailableSlots } from "@/lib/availability";

/** Só retorna horários de um barbeiro da mesma empresa do cliente autenticado — nunca de outra. */
export async function getAvailableSlotsAction(barberId: string, dateStr: string, totalDurationMinutes: number) {
  const customer = await getCurrentCustomer();
  if (!customer) return [];

  const barber = await prisma.barber.findFirst({ where: { id: barberId, companyId: customer.companyId }, select: { id: true } });
  if (!barber) return [];

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const slots = await getAvailableSlots({ barberId, date, totalDurationMinutes });
  return slots.map((s) => ({ iso: s.start.toISOString(), label: s.label }));
}
