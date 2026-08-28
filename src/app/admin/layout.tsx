import { requireAdminContext } from "@/lib/require-admin";
import { getNotificationsForUser, getUnreadCountForUser } from "@/lib/notifications";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const user = await requireAdminContext();
  const [notifications, unreadCount] = await Promise.all([
    getNotificationsForUser(user.companyId, user.id, 8),
    getUnreadCountForUser(user.companyId, user.id),
  ]);

  return (
    <AdminShell
      userName={user.name}
      roleLabel={user.role === "ADMIN" ? "Administrador" : "Barbeiro"}
      unreadCount={unreadCount}
      impersonatedBy={user.impersonatedBy}
      notifications={notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }))}
    >
      {children}
    </AdminShell>
  );
}
