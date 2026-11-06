import "server-only";
import { prisma } from "@/lib/prisma";
import { extendAllRecurringSeries, RECURRENCE_EXTENSION_TARGET } from "@/lib/recurring-engine";

const FLAG_KEY = "recurrence_extended_until";

/**
 * Estende UMA vez, por barbearia, as recorrências que já estavam cadastradas até dezembro de 2027 (continuando a
 * frequência de cada uma). Depois de rodar sem erro, grava um marcador na empresa e não repete. Para refazer
 * (ex.: outra data), use POST /api/system/cron/extend-recurrences?until=AAAA-MM-DD.
 */
export async function extendExistingRecurrencesOnce() {
  const companies = await prisma.company.findMany({
    where: { recurringAppointments: { some: { status: "ACTIVE" } } },
    select: { id: true, name: true },
  });
  for (const company of companies) {
    const done = await prisma.systemSetting.findUnique({ where: { companyId_key: { companyId: company.id, key: FLAG_KEY } } });
    if (done?.value === RECURRENCE_EXTENSION_TARGET) continue;

    const summary = await extendAllRecurringSeries({ companyId: company.id });
    const failed = summary.results.some((r) => r.reason === "erro");
    console.log(
      `[recorrências] ${company.name}: ${summary.extended} de ${summary.seriesChecked} estendidas até ${RECURRENCE_EXTENSION_TARGET} (${summary.generated} datas novas, ${summary.conflicts} em conflito)${failed ? " — houve erro, tenta de novo na próxima" : ""}.`
    );
    if (failed) continue;
    await prisma.systemSetting.upsert({
      where: { companyId_key: { companyId: company.id, key: FLAG_KEY } },
      update: { value: RECURRENCE_EXTENSION_TARGET },
      create: { companyId: company.id, key: FLAG_KEY, value: RECURRENCE_EXTENSION_TARGET },
    });
  }
}
