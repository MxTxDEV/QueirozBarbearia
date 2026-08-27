"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn, formatDate, formatTime } from "@/lib/utils";

export type BellNotification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: BellNotification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="relative rounded-xl p-2 text-foreground-muted transition-colors hover:bg-black/5 hover:text-foreground"
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
              <Link href="/admin/notifications" className="text-xs text-secondary-dark hover:underline" onClick={() => setOpen(false)}>
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
                    "rounded-xl px-3 py-2 text-sm transition-colors hover:bg-black/5",
                    !n.read && "bg-black/[0.03]"
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
