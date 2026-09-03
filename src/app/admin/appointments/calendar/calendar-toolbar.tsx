import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CALENDAR_VIEW_LABEL,
  dateOnlyUTC,
  periodLabel,
  shiftAnchor,
  toISODate,
  type CalendarView,
} from "./calendar-dates";

const VIEWS: CalendarView[] = ["day", "week", "month"];

/** Navegação e troca de visão do calendário — tudo por Link, sem estado no cliente. */
export function CalendarToolbar({
  view,
  anchor,
  buildHref,
}: {
  view: CalendarView;
  anchor: Date;
  buildHref: (params: { view?: CalendarView; date?: string }) => string;
}) {
  const today = dateOnlyUTC(new Date());

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Link
          href={buildHref({ date: toISODate(shiftAnchor(view, anchor, -1)) })}
          aria-label="Período anterior"
          className="rounded-xl border p-2 text-foreground-muted transition-colors hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link
          href={buildHref({ date: toISODate(shiftAnchor(view, anchor, 1)) })}
          aria-label="Próximo período"
          className="rounded-xl border p-2 text-foreground-muted transition-colors hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link href={buildHref({ date: toISODate(today) })}>
          <Button size="sm" variant="secondary">
            Hoje
          </Button>
        </Link>
        <p className="ml-1 min-w-0 text-sm font-medium text-foreground first-letter:uppercase">
          {periodLabel(view, anchor)}
        </p>
      </div>

      <div className="inline-flex items-center gap-1 rounded-full border p-1">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={buildHref({ view: v })}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-all",
              view === v ? "bg-secondary-dark text-white" : "text-foreground-muted hover:text-foreground"
            )}
          >
            {CALENDAR_VIEW_LABEL[v]}
          </Link>
        ))}
      </div>
    </div>
  );
}
