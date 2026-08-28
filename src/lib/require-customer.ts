import "server-only";
import { redirect } from "next/navigation";
import { getCurrentCustomer, type CurrentCustomer } from "@/lib/customer-auth";

export async function requireCustomerContext() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/portal/login");
  return customer;
}

export function isCustomerProfileIncomplete(customer: Pick<CurrentCustomer, "email" | "birthDate">) {
  return !customer.email || !customer.birthDate;
}

/**
 * Como requireCustomerContext, mas também exige cadastro completo (nome,
 * e-mail e data de nascimento). Usado em toda página do portal exceto a
 * própria /portal/profile, para forçar a conclusão do cadastro antes de
 * liberar o restante do portal.
 */
export async function requireCompleteCustomerProfile() {
  const customer = await requireCustomerContext();
  if (isCustomerProfileIncomplete(customer)) redirect("/portal/profile");
  return customer;
}
