import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeCustomerSlotConfig, type CustomerSlotConfig } from "@/lib/customer-slots";

/** Chaves em SystemSetting (por empresa) da grade de horários que o cliente vê ao agendar. */
export const CUSTOMER_SLOT_KEYS = { step: "customer_slot_step", start: "customer_slot_start" } as const;

/** Configuração da empresa; sem nada salvo, vale o padrão (45 em 45 min, a partir do início do expediente). */
export async function loadCustomerSlotConfig(companyId: string): Promise<CustomerSlotConfig> {
  const rows = await prisma.systemSetting.findMany({
    where: { companyId, key: { in: Object.values(CUSTOMER_SLOT_KEYS) } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return normalizeCustomerSlotConfig(byKey.get(CUSTOMER_SLOT_KEYS.step), byKey.get(CUSTOMER_SLOT_KEYS.start));
}
