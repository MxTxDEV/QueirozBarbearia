"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarClock, Users, Wallet, Target, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { label: string; href: string; icon: typeof LayoutDashboard };

const ADMIN_ITEMS: Item[] = [
  { label: "Início", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/admin/appointments", icon: CalendarClock },
  { label: "Clientes", href: "/admin/customers", icon: Users },
  { label: "Financeiro", href: "/admin/financial", icon: Wallet },
];

const BARBER_ITEMS: Item[] = [
  { label: "Início", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/admin/appointments", icon: CalendarClock },
  { label: "Clientes", href: "/admin/customers", icon: Users },
  { label: "Metas", href: "/admin/goals", icon: Target },
];

/**
 * As 4 seções mais usadas no dia a dia (só no mobile — o desktop já tem a
 * sidebar completa) + "Mais" abrindo o drawer com o resto. Financeiro só
 * aparece pro ADMIN — barbeiro não vê dados financeiros da empresa (mesma
 * regra do restante do painel).
 */
export function MobileBottomNav({ isAdmin, onOpenMore }: { isAdmin: boolean; onOpenMore: () => void }) {
  const pathname = usePathname();
  const items = isAdmin ? ADMIN_ITEMS : BARBER_ITEMS;

  return (
    <nav
      aria-label="Navegação inferior"
      className="glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-around py-1.5 md:hidden"
    >
      {items.map((item) => {
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
      <button
        type="button"
        onClick={onOpenMore}
        className="flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium text-foreground-muted transition-colors"
      >
        <Menu className="h-5 w-5" />
        Mais
      </button>
    </nav>
  );
}
