"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const goalSchema = z.object({
  title: z.string().min(2, "Informe um título."),
  type: z.enum(["REVENUE", "APPOINTMENTS", "BARBER_REVENUE"]),
  targetValue: z.coerce.number().positive("Informe uma meta válida."),
  startDate: z.string().min(1, "Informe a data inicial."),
  endDate: z.string().min(1, "Informe a data final."),
  barberId: z.string().optional().or(z.literal("")),
});

export async function createGoalAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdminContext();
    const data = goalSchema.parse({
      title: formData.get("title"),
      type: formData.get("type"),
      targetValue: formData.get("targetValue"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      barberId: formData.get("barberId"),
    });

    if (data.type === "BARBER_REVENUE" && !data.barberId) {
      return actionError(new Error("Selecione o barbeiro para uma meta por barbeiro."));
    }

    if (data.barberId) {
      const barber = await prisma.barber.findFirst({ where: { id: data.barberId, companyId: user.companyId }, select: { id: true } });
      if (!barber) return actionError(new Error("Barbeiro não encontrado."));
    }

    await prisma.financialGoal.create({
      data: {
        companyId: user.companyId,
        title: data.title,
        type: data.type,
        targetValue: data.targetValue,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        barberId: data.type === "BARBER_REVENUE" ? data.barberId || null : null,
      },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/goals");
  return actionSuccess();
}

export async function deleteGoalAction(id: string) {
  const user = await requireAdminContext();
  await prisma.financialGoal.deleteMany({ where: { id, companyId: user.companyId } });
  revalidatePath("/admin/goals");
}
