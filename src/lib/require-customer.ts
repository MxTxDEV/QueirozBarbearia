import "server-only";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer, type CurrentCustomer } from "@/lib/customer-auth";

export type PortalCompany = { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED" | "BLOCKED" };

/** Resolve a empresa do portal a partir do slug na URL. 404 se não existir — nunca confia no slug para nada além de localizar a empresa. */
export async function resolvePortalCompany(slug: string): Promise<PortalCompany> {
  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!company) notFound();
  return company;
}

/**
 * Garante que existe uma sessão de cliente válida E que essa sessão pertence
 * à empresa do slug atual (nunca ao contrário: o companyId usado nas
 * consultas sempre vem da sessão, nunca da URL). Se o cliente logado for de
 * outra empresa, ou não houver sessão, redireciona para o login desta
 * empresa — nunca mistura dados entre o slug visitado e a sessão de outra.
 */
export async function requireCustomerContext(slug: string): Promise<CurrentCustomer> {
  const company = await resolvePortalCompany(slug);
  const customer = await getCurrentCustomer();
  if (!customer || customer.companyId !== company.id) redirect(`/portal/${slug}/login`);
  return customer;
}

export function isCustomerProfileIncomplete(customer: Pick<CurrentCustomer, "email" | "birthDate">) {
  return !customer.email || !customer.birthDate;
}

/**
 * Como requireCustomerContext, mas também exige cadastro completo (nome,
 * e-mail e data de nascimento). Usado em toda página do portal exceto a
 * própria /portal/[company]/profile, para forçar a conclusão do cadastro
 * antes de liberar o restante do portal.
 */
export async function requireCompleteCustomerProfile(slug: string): Promise<CurrentCustomer> {
  const customer = await requireCustomerContext(slug);
  if (isCustomerProfileIncomplete(customer)) redirect(`/portal/${slug}/profile`);
  return customer;
}
