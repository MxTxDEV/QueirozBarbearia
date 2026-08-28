import { requireAdminContext } from "@/lib/require-admin";
import { getNotificationsForUser } from "@/lib/notifications";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/notifications";

export default async function NotificationsPage() {
  const user = await requireAdminContext();
  const notifications = await getNotificationsForUser(user.companyId, user.id, 100);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Notificações</h1>
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" size="sm" variant="secondary">
            Marcar todas como lidas
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && (
          <Card>
            <CardContent className="text-center text-sm text-foreground-muted">Nenhuma notificação ainda.</CardContent>
          </Card>
        )}
        {notifications.map((n) => (
          <Card key={n.id} className={cn(!n.read && "border-secondary/30")}>
            <CardContent className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-secondary" />}
                  <p className="font-medium text-foreground">{n.title}</p>
                </div>
                <p className="mt-1 text-sm text-foreground-muted">{n.message}</p>
                <p className="mt-1 text-xs text-foreground-muted/60">
                  {formatDate(n.createdAt)} às {formatTime(n.createdAt)}
                </p>
              </div>
              {!n.read && (
                <form action={markNotificationReadAction.bind(null, n.id)}>
                  <Button type="submit" size="sm" variant="ghost">
                    Marcar lida
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
