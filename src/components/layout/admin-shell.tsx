"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LogOut, ShieldAlert } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CompanyLogo } from "@/components/company-logo";
import { SidebarNav } from "./sidebar-nav";
import { ADMIN_NAV_SECTIONS } from "./nav-config";
import { NotificationsBell, type BellNotification } from "./notifications-bell";
import { CommandPalette } from "./command-palette";
import { SkipLink } from "./skip-link";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/actions/auth";
import { stopImpersonationAction } from "@/actions/superadmin";

export function AdminShell({
  children,
  userName,
  roleLabel,
  isAdmin,
  notifications,
  unreadCount,
  impersonatedBy,
  companyName,
  companyLogoUrl,
}: {
  children: React.ReactNode;
  userName: string;
  roleLabel: string;
  isAdmin: boolean;
  notifications: BellNotification[];
  unreadCount: number;
  impersonatedBy?: { id: string; name: string } | null;
  companyName: string;
  companyLogoUrl: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      {impersonatedBy && (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-warning/90 px-4 py-2 text-center text-sm font-medium text-black">
          <ShieldAlert className="h-4 w-4" />
          {impersonatedBy.name} está acessando este painel como {userName}.
          <form action={stopImpersonationAction}>
            <button type="submit" className="ml-1 underline underline-offset-2 hover:no-underline">
              Voltar ao SuperAdmin
            </button>
          </form>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
      {/* Sidebar - desktop (fixa: acompanha a rolagem da página) */}
      <aside className="glass sticky top-0 hidden h-full w-64 shrink-0 md:flex md:flex-col">
        <div className="flex h-16 items-center border-b px-5">
          <CompanyLogo logoUrl={companyLogoUrl} name={companyName} height={26} />
        </div>
        <SidebarNav sections={ADMIN_NAV_SECTIONS} isAdmin={isAdmin} />
        <div className="border-t p-3">
          <p className="truncate px-3 text-xs text-foreground-muted/70">{roleLabel}</p>
        </div>
      </aside>

      {/* Sidebar - mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="anim-overlay-in absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="anim-drawer-in glass-strong absolute left-0 top-0 flex h-full w-64 flex-col">
            <div className="flex h-16 items-center justify-between border-b px-5">
              <CompanyLogo logoUrl={companyLogoUrl} name={companyName} height={24} />
              <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="text-foreground-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav sections={ADMIN_NAV_SECTIONS} isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
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
            <CommandPalette />
            <ThemeToggle />
            <NotificationsBell notifications={notifications} unreadCount={unreadCount} />
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
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 pb-24 outline-none md:px-6 md:pb-6">
          {children}
        </main>
      </div>
      </div>
      <MobileBottomNav isAdmin={isAdmin} onOpenMore={() => setMobileOpen(true)} />
    </div>
  );
}

export function BrandLink() {
  return (
    <Link href="/admin/dashboard">
      <BrandLogo height={24} />
    </Link>
  );
}
