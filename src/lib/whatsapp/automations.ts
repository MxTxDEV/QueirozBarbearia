import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_RULES, KIND_DEFS, type AutomationKind, type CustomerSegments } from "./automation-defs";
import type { WhatsappAutomation } from "@prisma/client";

/**
 * Acesso às regras de mensagem automática de cada empresa (tabela whatsapp_automations).
 * A primeira vez que uma empresa é tocada, as regras padrão são criadas — com o mesmo
 * comportamento que o sistema já tinha antes da tela de edição.
 */

/** Empresas cujas regras padrão já foram garantidas neste processo — evita uma consulta a cada envio. */
const ensured = new Set<string>();

const SINGLETON_RULES = DEFAULT_RULES.filter((rule) => rule.kind !== "REMINDER_BEFORE");
const REMINDER_RULES = DEFAULT_RULES.filter((rule) => rule.kind === "REMINDER_BEFORE");

function toRow(companyId: string, rule: (typeof DEFAULT_RULES)[number]) {
  return {
    companyId,
    key: rule.key,
    kind: rule.kind,
    name: rule.name,
    offsetMinutes: rule.offsetMinutes ?? null,
    sendTime: rule.sendTime ?? null,
    dayOfMonth: rule.dayOfMonth ?? null,
    sortOrder: rule.sortOrder,
  };
}

/**
 * Cria o que falta das regras do sistema. Os lembretes "1 dia / 1 hora antes" só são criados na
 * primeira vez (quem apagou um deles não o vê voltar); os demais tipos sempre existem (só se desligam).
 */
export async function ensureAutomations(companyId: string) {
  if (ensured.has(companyId)) return;
  const existing = await prisma.whatsappAutomation.findMany({ where: { companyId }, select: { key: true } });
  const keys = new Set(existing.map((row) => row.key));
  const missing = SINGLETON_RULES.filter((rule) => !keys.has(rule.key));
  const firstTime = existing.length === 0;
  const rows = [...missing, ...(firstTime ? REMINDER_RULES : [])].map((rule) => toRow(companyId, rule));
  if (rows.length > 0) await prisma.whatsappAutomation.createMany({ data: rows, skipDuplicates: true });
  ensured.add(companyId);
}

export async function listAutomations(companyId: string): Promise<WhatsappAutomation[]> {
  await ensureAutomations(companyId);
  return prisma.whatsappAutomation.findMany({ where: { companyId }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function automationsOfKind(companyId: string, kind: AutomationKind): Promise<WhatsappAutomation[]> {
  return (await listAutomations(companyId)).filter((rule) => rule.kind === kind);
}

/** Texto de uma regra: o da empresa ou, se nunca foi editado, o padrão do sistema. */
export const templateOf = (rule: Pick<WhatsappAutomation, "kind" | "template">) =>
  rule.template ?? KIND_DEFS[rule.kind as AutomationKind].defaultTemplate;

/** O tipo de cliente (para decidir qual mensagem vale pra ele). */
export async function getCustomerSegments(companyId: string, customerId: string): Promise<CustomerSegments> {
  const [recurring, completed] = await Promise.all([
    prisma.recurringAppointment.count({ where: { companyId, customerId, status: "ACTIVE" } }),
    prisma.appointment.count({ where: { companyId, customerId, status: "COMPLETED" } }),
  ]);
  return { recurring: recurring > 0, hasCompleted: completed > 0 };
}

const nameCache = new Map<string, { name: string; at: number }>();
export async function companyDisplayName(companyId: string): Promise<string> {
  const cached = nameCache.get(companyId);
  if (cached && Date.now() - cached.at < 60_000) return cached.name;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  const name = company?.name ?? "";
  nameCache.set(companyId, { name, at: Date.now() });
  return name;
}
