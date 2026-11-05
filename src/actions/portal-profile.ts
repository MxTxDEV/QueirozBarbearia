"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-auth";
import { isCustomerProfileIncomplete } from "@/lib/require-customer";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const profileSchema = z.object({
  fullName: z.string().min(2, "Informe seu nome completo."),
  email: z.string().trim().email("E-mail inválido.").or(z.literal("")),
  birthDate: z.string(),
  companySlug: z.string().optional(),
});

export async function updateCustomerProfileAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let goToBooking: string | null = null;
  try {
    const customer = await requireCustomer();
    const data = profileSchema.parse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      birthDate: formData.get("birthDate") ?? "",
      companySlug: formData.get("companySlug") ?? undefined,
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        fullName: data.fullName,
        email: data.email || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
      },
    });
    // Era o primeiro acesso (só faltava o nome): segue direto para o agendamento.
    if (isCustomerProfileIncomplete(customer) && data.companySlug) goToBooking = `/portal/${data.companySlug}/book`;
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/portal/[company]", "layout");
  if (goToBooking) redirect(goToBooking);
  return actionSuccess();
}
