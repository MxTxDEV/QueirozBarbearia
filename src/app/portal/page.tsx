import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Compatibilidade com o antigo /portal/login sem slug: redireciona para o
 * portal da empresa mais antiga cadastrada. Só existe uma rota "coringa"
 * porque, historicamente, o sistema era single-tenant — links e mensagens
 * de WhatsApp já enviados antes do roteamento por empresa continuam
 * funcionando.
 */
export default async function PortalRootPage() {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" }, select: { slug: true } });
  if (!company) notFound();
  redirect(`/portal/${company.slug}/login`);
}
