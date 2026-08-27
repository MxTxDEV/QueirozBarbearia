"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-auth";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const profileSchema = z.object({
  fullName: z.string().min(2, "Informe seu nome completo."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
});

export async function updateCustomerProfileAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const customer = await requireCustomer();
    const data = profileSchema.parse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      birthDate: formData.get("birthDate"),
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        fullName: data.fullName,
        email: data.email || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
      },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/portal/profile");
  return actionSuccess();
}
