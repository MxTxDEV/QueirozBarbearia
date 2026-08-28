"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminContext } from "@/lib/require-admin";

export async function markNotificationReadAction(id: string) {
  const user = await requireAdminContext();
  await prisma.notification.updateMany({
    where: { id, companyId: user.companyId },
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
