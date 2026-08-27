"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const barberSchema = z.object({
  name: z.string().min(2, "Informe o nome do barbeiro."),
  phone: z.string().optional().or(z.literal("")),
  photoUrl: z.string().optional().or(z.literal("")),
  specialties: z.string().optional().or(z.literal("")),
});

export async function createBarberAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminContext();
    const data = barberSchema.parse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      photoUrl: formData.get("photoUrl"),
      specialties: formData.get("specialties"),
    });

    await prisma.barber.create({
      data: {
        name: data.name,
        phone: data.phone || undefined,
        photoUrl: data.photoUrl || undefined,
        specialties: data.specialties ? data.specialties.split(",").map((s) => s.trim()).filter(Boolean) : [],
      },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/barbers");
  return actionSuccess();
}

export async function updateBarberAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireAdminContext();
    const data = barberSchema.parse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      photoUrl: formData.get("photoUrl"),
      specialties: formData.get("specialties"),
    });

    await prisma.barber.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone || null,
        photoUrl: data.photoUrl || null,
        specialties: data.specialties ? data.specialties.split(",").map((s) => s.trim()).filter(Boolean) : [],
      },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/barbers");
  revalidatePath(`/admin/barbers/${id}`);
  return actionSuccess();
}

export async function toggleBarberActiveAction(id: string, active: boolean) {
  await requireAdminContext();
  await prisma.barber.update({ where: { id }, data: { active } });
  revalidatePath("/admin/barbers");
}

const workingHourSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  breakStart: z.string().optional().or(z.literal("")),
  breakEnd: z.string().optional().or(z.literal("")),
});

export async function upsertWorkingHourAction(barberId: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminContext();
    const data = workingHourSchema.parse({
      weekday: formData.get("weekday"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      breakStart: formData.get("breakStart"),
      breakEnd: formData.get("breakEnd"),
    });

    await prisma.barberWorkingHour.upsert({
      where: { barberId_weekday: { barberId, weekday: data.weekday } },
      update: {
        startTime: data.startTime,
        endTime: data.endTime,
        breakStart: data.breakStart || null,
        breakEnd: data.breakEnd || null,
      },
      create: {
        barberId,
        weekday: data.weekday,
        startTime: data.startTime,
        endTime: data.endTime,
        breakStart: data.breakStart || null,
        breakEnd: data.breakEnd || null,
      },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/admin/barbers/${barberId}`);
  return actionSuccess();
}

export async function removeWorkingHourAction(barberId: string, weekday: number) {
  await requireAdminContext();
  await prisma.barberWorkingHour.deleteMany({ where: { barberId, weekday } });
  revalidatePath(`/admin/barbers/${barberId}`);
}

const timeOffSchema = z.object({
  startDate: z.string().min(1, "Informe a data inicial."),
  endDate: z.string().min(1, "Informe a data final."),
  reason: z.string().optional().or(z.literal("")),
});

export async function createTimeOffAction(barberId: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminContext();
    const data = timeOffSchema.parse({
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      reason: formData.get("reason"),
    });

    await prisma.barberTimeOff.create({
      data: {
        barberId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason || undefined,
      },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath(`/admin/barbers/${barberId}`);
  return actionSuccess();
}

export async function removeTimeOffAction(barberId: string, timeOffId: string) {
  await requireAdminContext();
  await prisma.barberTimeOff.delete({ where: { id: timeOffId } });
  revalidatePath(`/admin/barbers/${barberId}`);
}

export async function toggleBarberServiceAction(barberId: string, serviceId: string, enabled: boolean) {
  await requireAdminContext();
  if (enabled) {
    await prisma.barberService.upsert({
      where: { barberId_serviceId: { barberId, serviceId } },
      update: {},
      create: { barberId, serviceId },
    });
  } else {
    await prisma.barberService.deleteMany({ where: { barberId, serviceId } });
  }
  revalidatePath(`/admin/barbers/${barberId}`);
}
