"use client";

import { shopNow } from "@/lib/shop-time";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BlockData } from "./appointment-block";
import { blockToDragSource, isMovableStatus, useTouchDropDialogs } from "./appointment-dnd";
import { TouchDraggable, dropTargetProps, type TouchDropTarget } from "./touch-drag";

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
 * Carrossel horizontal (swipe) de cards de agendamento de um único dia —
 * em vez da grade de horários, que exige rolagem horizontal entre colunas
 * de dias/barbeiros e fica ilegível na largura de um celular (ver
 * time-grid.tsx, só usado a partir de md:). Usado tanto pela visão de Dia
 * (um carrossel só) quanto pela de Semana (um carrossel por dia, um
 * abaixo do outro — ver MobileWeekAgenda).
 */
function DayCarousel({
  date,
  isToday,
  items,
  onTouchDrop,
}: {
  /** Dia (YYYY-MM-DD) deste carrossel — destino quando um card é solto na área do dia. */
  date: string;
  isToday: boolean;
  items: DayAgendaItem[];
  onTouchDrop: (sourceId: string, target: TouchDropTarget) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // No dia de hoje, centraliza no agendamento em andamento ou, se nenhum
  // estiver rolando, no próximo que vai começar. Sem "agora" relevante
  // (dia passado/futuro, ou hoje já sem mais agendamentos), o carrossel
  // simplesmente começa do primeiro card.
  useEffect(() => {
    if (!isToday || items.length === 0) return;
    const now = shopNow().getTime();
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

  const zoneProps = {
    ...dropTargetProps({ kind: "move", date }),
    className: "rounded-2xl data-[drop-hover=true]:ring-2 data-[drop-hover=true]:ring-secondary",
  };

  if (items.length === 0) {
    return (
      <div {...zoneProps}>
        <Card variant="solid" className="p-6 text-center text-sm text-foreground-muted">
          Nenhum agendamento neste dia.
        </Card>
      </div>
    );
  }

  return (
    <div {...zoneProps}>
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
            className="w-[80%] shrink-0 snap-center scale-95 opacity-70 transition-all duration-[var(--duration-base)] ease-out motion-reduce:transition-none data-[active=true]:scale-100 data-[active=true]:opacity-100"
          >
            <TouchDraggable
              id={item.block.id}
              label={`${item.block.timeLabel} · ${item.block.customerName}`}
              enabled={isMovableStatus(item.block.status)}
              onDrop={onTouchDrop}
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
            </TouchDraggable>
          </div>
        );
      })}
    </div>
    </div>
  );
}

/** Dica de como arrastar — só aparece se há algo que dê pra mover. */
function DragHint({ items }: { items: DayAgendaItem[] }) {
  if (!items.some((item) => isMovableStatus(item.block.status))) return null;
  return (
    <p className="text-xs text-foreground-muted">
      Segure um agendamento e arraste: em cima de outro troca os horários; no dia ou num horário livre, muda o horário.
    </p>
  );
}

/** Visão de Dia no celular: navegação de dia anterior/seguinte + um carrossel. */
export function MobileDayAgenda({
  date,
  dayLabel,
  isToday,
  prevHref,
  nextHref,
  todayHref,
  items,
  newHref,
  freeSlots,
  closed,
}: {
  /** Dia exibido (YYYY-MM-DD). */
  date: string;
  dayLabel: string;
  isToday: boolean;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  items: DayAgendaItem[];
  /** Novo agendamento neste dia (sem horário definido). */
  newHref?: string;
  /** Horários livres (de um barbeiro específico) como botões de agendamento rápido. */
  freeSlots?: { label: string; href: string; time: string; barberId: string }[];
  /** Ninguém atende neste dia. */
  closed?: boolean;
}) {
  const { onDrop, dialog } = useTouchDropDialogs(items.map((item) => blockToDragSource(item.block)));
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

      {closed && <ClosedDayNote />}
      <DayCarousel date={date} isToday={isToday} items={items} onTouchDrop={onDrop} />
      <DragHint items={items} />
      {dialog}

      {newHref && <NewAppointmentLink href={newHref} />}
      {freeSlots && freeSlots.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-foreground-muted">Horários livres — toque para agendar (ou solte um agendamento aqui para mudar o horário)</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {freeSlots.map((slot) => (
              <Link
                key={slot.href}
                href={slot.href}
                {...dropTargetProps({ kind: "move", date, time: slot.time, barberId: slot.barberId })}
                className="shrink-0 rounded-full border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--surface-subtle-hover)] data-[drop-hover=true]:border-secondary data-[drop-hover=true]:bg-secondary/25"
              >
                {slot.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClosedDayNote() {
  return (
    <p className="flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-sm text-foreground-muted">
      <Lock className="h-3.5 w-3.5" /> Fechado neste dia
    </p>
  );
}

function NewAppointmentLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-secondary-light transition-colors hover:bg-[var(--surface-subtle-hover)]"
    >
      <Plus className="h-3.5 w-3.5" /> Novo agendamento neste dia
    </Link>
  );
}

export type WeekDaySection = {
  day: Date;
  dayLabel: string;
  isToday: boolean;
  items: DayAgendaItem[];
  /** Novo agendamento neste dia — ausente em dias passados. */
  newHref?: string;
  closed?: boolean;
};

/**
 * Visão de Semana no celular: um dia abaixo do outro (a navegação de
 * semana já está na barra do calendário, compartilhada com o desktop) —
 * cada dia com seu próprio carrossel de cards, igual ao da visão de Dia.
 */
export function MobileWeekAgenda({ days }: { days: WeekDaySection[] }) {
  const allItems = days.flatMap((d) => d.items);
  const { onDrop, dialog } = useTouchDropDialogs(allItems.map((item) => blockToDragSource(item.block)));
  return (
    <div className="space-y-5 md:hidden">
      <DragHint items={allItems} />
      {dialog}
      {days.map((d) => (
        <div key={d.day.toISOString()}>
          <p
            className={cn(
              "mb-2 text-sm font-medium first-letter:uppercase",
              d.isToday ? "text-secondary-light" : "text-foreground"
            )}
          >
            {d.dayLabel}
          </p>
          {d.closed && <ClosedDayNote />}
          <DayCarousel date={d.day.toISOString().slice(0, 10)} isToday={d.isToday} items={d.items} onTouchDrop={onDrop} />
          {d.newHref && (
            <div className="mt-2">
              <NewAppointmentLink href={d.newHref} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
