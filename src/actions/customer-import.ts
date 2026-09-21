"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { normalizeWhatsapp } from "@/lib/utils";
import { parseCustomerWorkbook } from "@/lib/customer-import";
import { logAudit } from "@/lib/audit";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

export type CustomerImportSummary = {
  createdCount: number;
  skippedDuplicateCount: number;
  errors: { rowNumber: number; reason: string }[];
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Importa clientes em massa a partir de uma planilha (.xlsx/.xls/.csv) —
 * pensada pra migrar a base de clientes de um sistema antigo. Nunca
 * sobrescreve um cliente existente: quem já tem esse WhatsApp cadastrado
 * nesta empresa é apenas contado como "duplicado", preservando os dados
 * (e histórico de agendamentos) já existentes. Uma linha com nome ou
 * telefone inválido não derruba o restante do arquivo — fica só registrada
 * na lista de erros pra correção manual.
 */
export async function importCustomersAction(
  _prev: ActionResult<CustomerImportSummary> | undefined,
  formData: FormData
): Promise<ActionResult<CustomerImportSummary>> {
  try {
    const user = await requireAdminContext();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return actionError(new Error("Selecione um arquivo de planilha (.xlsx, .xls ou .csv)."));
    }
    if (file.size > MAX_FILE_BYTES) {
      return actionError(new Error("Arquivo muito grande (máximo 5MB)."));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors } = parseCustomerWorkbook(buffer);

    if (rows.length === 0 && errors.length === 0) {
      return actionError(new Error("A planilha está vazia."));
    }

    const existing = await prisma.customer.findMany({
      where: { companyId: user.companyId },
      select: { whatsapp: true },
    });
    const existingWhatsapps = new Set(existing.map((c) => c.whatsapp));

    const toCreate: { fullName: string; whatsapp: string; email?: string; birthDate?: Date; notes?: string }[] = [];
    const seenInFile = new Set<string>();
    let skippedDuplicateCount = 0;

    for (const row of rows) {
      const whatsapp = normalizeWhatsapp(row.whatsappRaw);
      if (!whatsapp) {
        errors.push({ rowNumber: row.rowNumber, reason: `Telefone inválido: "${row.whatsappRaw}".` });
        continue;
      }
      if (existingWhatsapps.has(whatsapp) || seenInFile.has(whatsapp)) {
        skippedDuplicateCount++;
        continue;
      }
      seenInFile.add(whatsapp);
      toCreate.push({
        fullName: row.fullName,
        whatsapp,
        email: row.email,
        birthDate: row.birthDate,
        notes: row.cpf ? `CPF: ${row.cpf}` : undefined,
      });
    }

    if (toCreate.length > 0) {
      await prisma.customer.createMany({
        data: toCreate.map((c) => ({ ...c, companyId: user.companyId })),
        skipDuplicates: true,
      });
    }

    await logAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "customers_imported",
      entityType: "customer",
      entityId: user.companyId,
      metadata: {
        fileName: file.name,
        createdCount: toCreate.length,
        skippedDuplicateCount,
        errorCount: errors.length,
      },
    });

    revalidatePath("/admin/customers");

    return actionSuccess({
      createdCount: toCreate.length,
      skippedDuplicateCount,
      errors,
    });
  } catch (error) {
    return actionError(error);
  }
}
