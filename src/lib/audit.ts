import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Registra um evento de auditoria para alterações críticas do sistema
 * (Regra 5). companyId é nulo apenas para eventos de plataforma feitos pelo
 * SUPERADMIN (ex: criar/bloquear uma empresa) — todo evento dentro de uma
 * empresa deve sempre informar o companyId correspondente.
 */
export async function logAudit(params: {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  appointmentId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      companyId: params.companyId ?? null,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      appointmentId: params.appointmentId,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}
