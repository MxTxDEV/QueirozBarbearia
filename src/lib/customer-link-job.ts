import "server-only";
import { prisma } from "@/lib/prisma";
import { linkDuplicateCustomers } from "@/lib/customer-link";

const FLAG_KEY = "customers_linked_v1";

/**
 * Uma vez por barbearia: une os cadastros repetidos do mesmo cliente (mesmo celular com e sem o 9, ex.: o que a
 * barbearia cadastrou e o que nasceu quando o cliente entrou no app). Depois grava um marcador e não repete —
 * dali em diante o vínculo acontece na hora, no login do cliente e no cadastro pela barbearia.
 */
export async function linkExistingCustomersOnce() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  for (const company of companies) {
    const done = await prisma.systemSetting.findUnique({ where: { companyId_key: { companyId: company.id, key: FLAG_KEY } } });
    if (done) continue;
    try {
      const merged = await linkDuplicateCustomers(company.id);
      console.log(`[clientes] ${company.name}: ${merged} cadastro(s) repetido(s) unido(s).`);
      await prisma.systemSetting.upsert({
        where: { companyId_key: { companyId: company.id, key: FLAG_KEY } },
        update: { value: "1" },
        create: { companyId: company.id, key: FLAG_KEY, value: "1" },
      });
    } catch (error) {
      console.error(`[clientes] falha ao unir cadastros de ${company.name}:`, error);
    }
  }
}
