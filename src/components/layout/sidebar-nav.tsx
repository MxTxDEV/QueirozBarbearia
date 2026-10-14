"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav-config";

export function SidebarNav({
  sections,
  onNavigate,
  isAdmin = true,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
  /** false = login de barbeiro: esconde itens adminOnly (financeiro, relatórios, usuários). */
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {sections.map((section, i) => {
        const items = isAdmin ? section.items : section.items.filter((item) => !item.adminOnly);
        if (items.length === 0) return null;
        return (
        <div key={i}>
          {section.title && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-[var(--badge-secondary-bg)] text-foreground shadow-[inset_3px_0_0_0_var(--color-secondary)]"
                        : "text-foreground-muted hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active && "text-secondary-light")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        );
      })}
    </nav>
  );
}
