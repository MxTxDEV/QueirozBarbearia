import { hhmmToMinutes, type Interval } from "@/lib/quick-slots";

/**
 * Dias marcados na agenda (feriado, folga, fora de expediente) — parte PURA (sem banco), usada pelo
 * motor de disponibilidade, pelo calendário e pela tela de marcação.
 */

export const MARK_KINDS = ["HOLIDAY", "DAY_OFF", "OUT_OF_HOURS"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export const MARK_LABEL: Record<MarkKind, string> = {
  HOLIDAY: "Feriado",
  DAY_OFF: "Folga",
  OUT_OF_HOURS: "Fora de expediente",
};

export const MARK_HINT: Record<MarkKind, string> = {
  HOLIDAY: "A barbearia não abre. Ninguém consegue agendar nesse dia.",
  DAY_OFF: "Folga da barbearia toda ou de um barbeiro específico.",
  OUT_OF_HOURS: "Dia ou horário fora do expediente (evento, manutenção, reunião…).",
};

/** Cores de cada tipo (mini calendário, calendário e legenda) — as mesmas em todo lugar. */
export const MARK_COLOR: Record<MarkKind, { dot: string; cell: string; chip: string; text: string; ring: string; top: string }> = {
  HOLIDAY: { dot: "bg-red-500", cell: "bg-red-500/25 ring-1 ring-red-500/50", chip: "border-red-500/50 bg-red-500/15 text-red-300", text: "text-red-300", ring: "ring-red-500", top: "border-t-[3px] border-t-red-500" },
  DAY_OFF: { dot: "bg-sky-500", cell: "bg-sky-500/25 ring-1 ring-sky-500/50", chip: "border-sky-500/50 bg-sky-500/15 text-sky-300", text: "text-sky-300", ring: "ring-sky-500", top: "border-t-[3px] border-t-sky-500" },
  OUT_OF_HOURS: {
    dot: "bg-violet-500",
    cell: "bg-violet-500/25 ring-1 ring-violet-500/50",
    chip: "border-violet-500/50 bg-violet-500/15 text-violet-300",
    text: "text-violet-300",
    ring: "ring-violet-500",
    top: "border-t-[3px] border-t-violet-500",
  },
};

export type MarkLike = {
  kind: string;
  barberId: string | null;
  title: string | null;
  startTime: string | null;
  endTime: string | null;
};

export const isMarkKind = (value: string): value is MarkKind => (MARK_KINDS as readonly string[]).includes(value);

/** Tem janela de horário (só "fora de expediente" pode ter); sem janela = dia inteiro. */
export const hasWindow = (mark: Pick<MarkLike, "startTime" | "endTime">) => Boolean(mark.startTime && mark.endTime);

/** Texto curto: "Feriado — Finados", "Folga", "Fora de expediente — Manutenção (14:00–18:00)". */
export function markReason(mark: MarkLike): string {
  const label = isMarkKind(mark.kind) ? MARK_LABEL[mark.kind] : "Dia marcado";
  const title = mark.title?.trim();
  const window = hasWindow(mark) ? ` (${mark.startTime}–${mark.endTime})` : "";
  return `${label}${title ? ` — ${title}` : ""}${window}`;
}

export const appliesToBarber = (mark: Pick<MarkLike, "barberId">, barberId: string) => mark.barberId === null || mark.barberId === barberId;

/** O que as marcas aplicáveis a UM barbeiro naquele dia fecham: o dia todo (com o motivo) e/ou janelas. */
export function closuresFor(marks: MarkLike[], barberId: string): { wholeDay: string | null; windows: (Interval & { reason: string })[] } {
  let wholeDay: string | null = null;
  const windows: (Interval & { reason: string })[] = [];
  for (const mark of marks) {
    if (!appliesToBarber(mark, barberId)) continue;
    if (hasWindow(mark)) {
      windows.push({ start: hhmmToMinutes(mark.startTime as string), end: hhmmToMinutes(mark.endTime as string), reason: markReason(mark) });
    } else {
      wholeDay = wholeDay ?? markReason(mark);
    }
  }
  return { wholeDay, windows };
}

/** O tipo que "manda" na cor do dia quando há mais de um: feriado > folga > fora de expediente. */
export function dominantKind(marks: Pick<MarkLike, "kind">[]): MarkKind | null {
  for (const kind of MARK_KINDS) if (marks.some((m) => m.kind === kind)) return kind;
  return null;
}

/** Erro (pt-BR) se a janela "fora de expediente" não faz sentido; null se ok. */
export function validateMarkWindow(startTime: string | null | undefined, endTime: string | null | undefined): string | null {
  if (!startTime && !endTime) return null;
  if (!startTime || !endTime) return "Informe o início e o fim do horário (ou deixe os dois em branco para o dia todo).";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) return "Horário inválido.";
  if (hhmmToMinutes(endTime) <= hhmmToMinutes(startTime)) return "O fim precisa ser depois do início.";
  return null;
}
