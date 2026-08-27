"use server";

import { getAvailableSlots } from "@/lib/availability";

export async function getAvailableSlotsAction(barberId: string, dateStr: string, totalDurationMinutes: number) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const slots = await getAvailableSlots({ barberId, date, totalDurationMinutes });
  return slots.map((s) => ({ iso: s.start.toISOString(), label: s.label }));
}
