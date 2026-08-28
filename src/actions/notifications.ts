"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";
import { getNotificationsForUser, getUnreadCountForUser } from "@/lib/notifications";

/** Snapshot usado pelo sino de notificações para se atualizar sozinho, sem depender de um novo carregamento da página. */
export async function getNotificationsSnapshotAction() {
  const user = await requireAdminContext();
  const [notifications, unreadCount] = await Promise.all([
    getNotificationsForUser(user.companyId, user.id, 8),
    getUnreadCountForUser(user.companyId, user.id),
  ]);

  return {
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationReadAction(id: string) {
  const user = await requireAdminContext();
  // updateMany (não update) para não lançar quando a notificação pertence a
  // outro usuário — apenas não faz nada, sem vazar/alterar dado de terceiros.
  await prisma.notification.updateMany({
    where: { id, companyId: user.companyId, OR: [{ userId: user.id }, { userId: null }] },
    data: { read: true },
  });
  revalidatePath("/admin/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await requireAdminContext();
  await prisma.notification.updateMany({
    where: { companyId: user.companyId, OR: [{ userId: user.id }, { userId: null }], read: false },
    data: { read: true },
  });
  revalidatePath("/admin/notifications");
}
