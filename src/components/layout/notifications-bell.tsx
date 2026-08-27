"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { getNotificationsSnapshotAction } from "@/actions/notifications";

const POLL_INTERVAL_MS = 15000;

export type BellNotification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NotificationsBell({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
}: {
  notifications: BellNotification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  // Atualiza sozinho em segundo plano — o admin vê novos alertas (ex: novo
  // agendamento) sem precisar recarregar a página.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const snapshot = await getNotificationsSnapshotAction();
        setNotifications(snapshot.notifications);
        setUnreadCount(snapshot.unreadCount);
      } catch {
        // sessão pode ter expirado; ignora e tenta de novo no próximo ciclo
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative">
      <button
        className="relative rounded-xl p-2 text-foreground-muted transition-colors hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
        aria-label="Notificações"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass-strong absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-2xl p-2">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold text-foreground">Notificações</span>
              <Link href="/admin/notifications" className="text-xs text-secondary-light hover:underline" onClick={() => setOpen(false)}>
                Ver todas
              </Link>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-foreground-muted">Nenhuma notificação ainda.</p>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-subtle-hover)]",
                    !n.read && "bg-[var(--surface-subtle)]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />}
                    <p className="font-medium text-foreground">{n.title}</p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-foreground-muted">{n.message}</p>
                  <p className="mt-1 text-[11px] text-foreground-muted/60">
                    {formatDate(n.createdAt)} às {formatTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
