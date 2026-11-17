import "server-only";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { phoneVariants } from "@/lib/utils";

/**
 * Vínculo de cadastros do mesmo cliente. O mesmo celular aparece escrito de jeitos diferentes (com e sem o 9
 * depois do DDD) e a barbearia pode ter cadastrado o cliente de um jeito enquanto ele entra no app de outro:
 * viravam dois cadastros, e o app do cliente (que mostra "Meus horários" e as recorrências) abria o cadastro
 * vazio, sem os horários que a barbearia marcou. Aqui o número é comparado pelas duas formas e os cadastros
 * repetidos são unidos num só.
 */

const PLACEHOLDER_NAME = "Cliente";

type Candidate = { id: string; fullName: string; email: string | null; birthDate: Date | null; notes: string | null; createdAt: Date; weight: number };

async function candidatesFor(companyId: string, whatsapp: string): Promise<Candidate[]> {
  const rows = await prisma.customer.findMany({
    where: { companyId, whatsapp: { in: phoneVariants(whatsapp) } },
    select: {
      id: true,
      fullName: true,
      email: true,
      birthDate: true,
      notes: true,
      createdAt: true,
      _count: { select: { appointments: true, recurringAppointments: true } },
    },
  });
  return rows
    .map((r) => ({ id: r.id, fullName: r.fullName, email: r.email, birthDate: r.birthDate, notes: r.notes, createdAt: r.createdAt, weight: r._count.appointments + r._count.recurringAppointments * 5 }))
    .sort((a, b) => b.weight - a.weight || a.createdAt.getTime() - b.createdAt.getTime());
}

/** Passa tudo do cadastro repetido para o principal (horários, recorrências, pagamentos, mensagens, sessões) e apaga o repetido. */
export async function mergeCustomers(companyId: string, primaryId: string, duplicateId: string) {
  if (primaryId === duplicateId) return;
  const [primary, dup] = await Promise.all([
    prisma.customer.findFirst({ where: { id: primaryId, companyId } }),
    prisma.customer.findFirst({ where: { id: duplicateId, companyId } }),
  ]);
  if (!primary || !dup) return;

  await prisma.$transaction(async (tx) => {
    const data = { customerId: primaryId };
    const where = { customerId: duplicateId };
    await tx.appointment.updateMany({ where, data });
    await tx.recurringAppointment.updateMany({ where, data });
    await tx.sale.updateMany({ where, data });
    await tx.payment.updateMany({ where, data });
    await tx.financialTransaction.updateMany({ where, data });
    await tx.whatsappMessage.updateMany({ where, data });
    await tx.waitlistEntry.updateMany({ where, data });
    await tx.customerSession.updateMany({ where, data });
    await tx.customerOtp.updateMany({ where, data });
    // Aviso mensal é único por cliente+mês: onde o principal já tem, o do repetido sai.
    const months = (await tx.monthlyRecurrenceNotice.findMany({ where: { customerId: primaryId }, select: { month: true } })).map((m) => m.month);
    if (months.length > 0) await tx.monthlyRecurrenceNotice.deleteMany({ where: { customerId: duplicateId, month: { in: months } } });
    await tx.monthlyRecurrenceNotice.updateMany({ where, data });

    // Completa o principal com o que só o repetido tinha (nome de verdade, e-mail, nascimento, observações).
    await tx.customer.update({
      where: { id: primaryId },
      data: {
        ...(primary.fullName.trim() === PLACEHOLDER_NAME && dup.fullName.trim() !== PLACEHOLDER_NAME ? { fullName: dup.fullName } : {}),
        ...(!primary.email && dup.email ? { email: dup.email } : {}),
        ...(!primary.birthDate && dup.birthDate ? { birthDate: dup.birthDate } : {}),
        ...(!primary.notes && dup.notes ? { notes: dup.notes } : {}),
      },
    });
    await tx.customer.delete({ where: { id: duplicateId } });
  });

  await logAudit({
    companyId,
    action: "customer_merged",
    entityType: "customer",
    entityId: primaryId,
    metadata: { mergedFrom: { id: dup.id, fullName: dup.fullName, whatsapp: dup.whatsapp, createdAt: dup.createdAt.toISOString() } },
  });
}

/**
 * Cadastro do cliente para um número: acha pelas duas formas do celular e, se houver mais de um, une
 * num só (fica o que tem mais horários/recorrências). Devolve o principal, ou null se não existe.
 */
export async function findAndLinkCustomerByPhone(companyId: string, whatsapp: string): Promise<{ id: string; whatsapp: string; fullName: string } | null> {
  const list = await candidatesFor(companyId, whatsapp);
  if (list.length === 0) return null;
  const [primary, ...duplicates] = list;
  for (const dup of duplicates) {
    try {
      await mergeCustomers(companyId, primary.id, dup.id);
    } catch (error) {
      console.error(`[clientes] falha ao unir o cadastro ${dup.id} em ${primary.id}:`, error);
    }
  }
  const row = await prisma.customer.findFirst({ where: { id: primary.id, companyId }, select: { id: true, whatsapp: true, fullName: true } });
  return row;
}

/** Une, de uma vez, os cadastros repetidos de uma empresa (mesmo celular com e sem o 9). Devolve quantos uniu. */
export async function linkDuplicateCustomers(companyId: string): Promise<number> {
  const all = await prisma.customer.findMany({ where: { companyId }, select: { id: true, whatsapp: true } });
  const groups = new Map<string, string[]>();
  for (const c of all) {
    // Chave = a forma SEM o 9 (as duas formas do mesmo celular caem no mesmo grupo).
    const key = [...phoneVariants(c.whatsapp)].sort()[0];
    groups.set(key, [...(groups.get(key) ?? []), c.whatsapp]);
  }
  let merged = 0;
  for (const numbers of groups.values()) {
    if (new Set(numbers).size < 2) continue;
    const before = await prisma.customer.count({ where: { companyId, whatsapp: { in: numbers } } });
    await findAndLinkCustomerByPhone(companyId, numbers[0]);
    const after = await prisma.customer.count({ where: { companyId, whatsapp: { in: numbers } } });
    merged += before - after;
  }
  return merged;
}
