"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";

export async function markNotificationReadAction(id: string) {
  const user = await requireAdminContext();
  // updateMany (não update) para não lançar quando a notificação pertence a
  // outro usuário — apenas não faz nada, sem vazar/alterar dado de terceiros.
  await prisma.notification.updateMany({
    where: { id, OR: [{ userId: user.id }, { userId: null }] },
    data: { read: true },
  });
  revalidatePath("/admin/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await requireAdminContext();
  await prisma.notification.updateMany({
    where: { OR: [{ userId: user.id }, { userId: null }], read: false },
    data: { read: true },
  });
  revalidatePath("/admin/notifications");
}
