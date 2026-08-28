"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BlockData } from "./appointment-block";

export type DayAgendaItem = {
  block: BlockData;
  actions?: React.ReactNode;
  startTime: Date;
  endTime: Date;
};

const STATUS_BADGE_VARIANT: Record<string, "warning" | "accent" | "success" | "danger" | "muted"> = {
  PENDING: "warning",
  CONFIRMED: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "muted",
};

/**
 * Agenda do dia em celular: um carrossel horizontal (swipe) de cards, um
 * por agendamento — em vez da grade de horários, que exige rolagem
 * horizontal entre colunas de dias/barbeiros e fica ilegível na largura de
 * um celular (ver time-grid.tsx, só usado a partir de md:). Ao abrir no
 * dia de hoje, já centraliza no agendamento em andamento ou no próximo.
 */
export function MobileDayAgenda({
  dayLabel,
  isToday,
  prevHref,
  nextHref,
  todayHref,
  items,
}: {
  dayLabel: string;
  isToday: boolean;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  items: DayAgendaItem[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Ao abrir hoje, centraliza no agendamento atual (em andamento agora) ou,
  // se nenhum estiver rolando, no próximo que vai começar. Sem "agora"
  // relevante (dia passado/futuro, ou hoje já sem mais agendamentos), o
  // carrossel simplesmente começa do primeiro card.
  useEffect(() => {
    if (!isToday || items.length === 0) return;
    const now = Date.now();
    let targetIndex = items.findIndex((i) => i.startTime.getTime() <= now && now < i.endTime.getTime());
    if (targetIndex === -1) targetIndex = items.findIndex((i) => i.startTime.getTime() > now);
    if (targetIndex === -1) targetIndex = items.length - 1;
    cardRefs.current[targetIndex]?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, [isToday, items]);

  // Realça o card centralizado (leve zoom/opacidade) conforme o swipe.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = cardRefs.current.filter((c): c is HTMLDivElement => c !== null);
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          (entry.target as HTMLElement).dataset.active = entry.intersectionRatio > 0.6 ? "true" : "false";
        }
      },
      { root: scroller, threshold: [0, 0.6, 1] }
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [items]);

  return (
    <div className="space-y-3 md:hidden">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={prevHref}
          aria-label="Dia anterior"
          className="rounded-xl border p-2 text-foreground-muted transition-colors hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground first-letter:uppercase">{dayLabel}</p>
          {!isToday && (
            <Link href={todayHref} className="text-xs text-secondary-light hover:underline">
              Voltar para hoje
            </Link>
          )}
        </div>
        <Link
          href={nextHref}
          aria-label="Próximo dia"
          className="rounded-xl border p-2 text-foreground-muted transition-colors hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {items.length === 0 ? (
        <Card variant="solid" className="p-6 text-center text-sm text-foreground-muted">
          Nenhum agendamento neste dia.
        </Card>
      ) : (
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[10%] pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, i) => {
            const cancelled = item.block.status === "CANCELLED" || item.block.status === "NO_SHOW";
            return (
              <div
                key={item.block.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                data-active="false"
                className="w-[80%] shrink-0 snap-center scale-95 opacity-70 transition-all duration-300 ease-out data-[active=true]:scale-100 data-[active=true]:opacity-100"
              >
                <Card variant="solid" className={cn("space-y-3 p-4", cancelled && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-base font-semibold text-foreground", cancelled && "line-through")}>
                      {item.block.timeLabel}
                    </p>
                    <Badge variant={STATUS_BADGE_VARIANT[item.block.status] ?? "muted"}>{item.block.statusLabel}</Badge>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.block.customerName}</p>
                    <p className="text-xs text-foreground-muted">
                      {item.block.services} · {item.block.barberName}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-sm font-medium text-foreground">{item.block.price}</p>
                    {item.actions}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
