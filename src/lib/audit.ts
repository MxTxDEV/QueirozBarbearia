import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Registra um evento de auditoria para alterações críticas do sistema (Regra 5). */
export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  appointmentId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      appointmentId: params.appointmentId,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}
