import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/** Cria uma notificação interna. userId nulo = visível para todos os administradores/barbeiros. */
export async function createNotification(params: {
  userId?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId ?? null,
      title: params.title,
      message: params.message,
      type: params.type,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
  });
}

export async function getNotificationsForUser(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCountForUser(userId: string) {
  return prisma.notification.count({
    where: { OR: [{ userId }, { userId: null }], read: false },
  });
}
