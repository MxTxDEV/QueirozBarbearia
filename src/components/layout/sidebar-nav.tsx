"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav-config";

export function SidebarNav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {sections.map((section, i) => (
        <div key={i}>
          {section.title && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted/70">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-gradient-to-r from-secondary to-secondary-dark text-white shadow-[0_4px_16px_rgba(14,165,233,0.3)]"
                        : "text-foreground-muted hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
