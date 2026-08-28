"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LogOut, ShieldCheck } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { SUPERADMIN_NAV_SECTIONS } from "./nav-config";
import { logoutAction } from "@/actions/auth";

export function SuperAdminShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <ShieldCheck className="h-5 w-5 text-accent-light" />
          <span className="font-semibold text-foreground">Barber Pro Admin</span>
        </div>
        <SidebarNav sections={SUPERADMIN_NAV_SECTIONS} />
        <div className="border-t p-3">
          <p className="truncate px-3 text-xs text-foreground-muted/70">Super Admin</p>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="glass-strong absolute left-0 top-0 flex h-full w-64 flex-col">
            <div className="flex h-16 items-center justify-between border-b px-5">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="h-5 w-5 text-accent-light" /> Barber Pro Admin
              </span>
              <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="text-foreground-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav sections={SUPERADMIN_NAV_SECTIONS} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between px-4 md:px-6">
          <button
            className="rounded-xl p-2 text-foreground-muted hover:bg-[var(--surface-subtle-hover)] md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden flex-1 md:block" />
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden text-sm text-foreground-muted hover:text-foreground sm:block">
              Ver site
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-light to-accent text-xs font-semibold text-white">
                {userName.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-foreground">{userName}</span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-xl p-2 text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
