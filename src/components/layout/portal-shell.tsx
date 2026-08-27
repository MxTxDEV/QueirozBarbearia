"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarPlus, CalendarClock, User, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { logoutCustomerAction } from "@/actions/customer-auth";

const NAV = [
  { label: "Início", href: "/portal/dashboard", icon: LayoutDashboard },
  { label: "Agendar", href: "/portal/book", icon: CalendarPlus },
  { label: "Meus horários", href: "/portal/appointments", icon: CalendarClock },
  { label: "Perfil", href: "/portal/profile", icon: User },
];

export function PortalShell({ children, customerName }: { children: React.ReactNode; customerName: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col pb-20 md:pb-0">
      <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/portal/dashboard">
          <BrandLogo height={22} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-white/10 text-foreground" : "text-foreground-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-foreground-muted sm:block">{customerName}</span>
          <form action={logoutCustomerAction}>
            <button type="submit" className="rounded-xl p-2 text-foreground-muted hover:bg-white/5" aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 md:px-6">{children}</main>

      <nav className="glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-around py-2 md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-secondary-light" : "text-foreground-muted"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
