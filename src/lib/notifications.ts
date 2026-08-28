import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/** Cria uma notificação interna, sempre associada a uma empresa. userId nulo = visível para todos os administradores/barbeiros dessa empresa. */
export async function createNotification(params: {
  companyId: string;
  userId?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  return prisma.notification.create({
    data: {
      companyId: params.companyId,
      userId: params.userId ?? null,
      title: params.title,
      message: params.message,
      type: params.type,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
  });
}

export async function getNotificationsForUser(companyId: string, userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { companyId, OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCountForUser(companyId: string, userId: string) {
  return prisma.notification.count({
    where: { companyId, OR: [{ userId }, { userId: null }], read: false },
  });
}
