/**
 * Cálculo puro (sem banco) dos horários livres mostrados como botões "+" no
 * calendário. Trabalha em minutos desde 00:00 do dia (mesma convenção UTC
 * "relógio da barbearia" do resto do sistema — ver availability-helpers).
 */

export type Interval = { start: number; end: number };

/** Remove de `open` tudo que cai dentro de `busy`. Entrada em qualquer ordem. */
export function subtractIntervals(open: Interval[], busy: Interval[]): Interval[] {
  let result = open.filter((i) => i.end > i.start).map((i) => ({ ...i }));
  for (const b of busy) {
    if (b.end <= b.start) continue;
    const next: Interval[] = [];
    for (const o of result) {
      if (b.end <= o.start || b.start >= o.end) {
        next.push(o);
        continue;
      }
      if (b.start > o.start) next.push({ start: o.start, end: b.start });
      if (b.end < o.end) next.push({ start: b.end, end: o.end });
    }
    result = next;
  }
  return result.sort((a, b) => a.start - b.start);
}

/**
 * Inícios (em minutos) de cada célula de `stepMinutes` totalmente contida num
 * intervalo livre e que começa a partir de `notBeforeMinute` (usado pra
 * esconder o que já passou hoje). Alinhado à grade, não ao início do
 * intervalo: expediente 09:10 → primeira célula de 30min livre é 09:30.
 */
export function openSlotStarts(open: Interval[], stepMinutes = 30, notBeforeMinute = 0): number[] {
  const starts = new Set<number>();
  for (const o of open) {
    let t = Math.ceil(o.start / stepMinutes) * stepMinutes;
    for (; t + stepMinutes <= o.end; t += stepMinutes) {
      if (t >= notBeforeMinute) starts.add(t);
    }
  }
  return [...starts].sort((a, b) => a - b);
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minutos desde 00:00. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Horários "trancados" (fechados) do calendário
// ---------------------------------------------------------------------------

export type ClosedSegment = Interval & { reason: string };

const DAY_MINUTES = 24 * 60;

/**
 * Trechos do dia em que o barbeiro NÃO atende, cada um com o motivo — o
 * calendário desenha esses trechos "trancados". Agendamentos e HOLDs não
 * entram aqui (são horário ocupado, não fechado). Prioridade quando dois
 * motivos se sobrepõem: folga/dia sem expediente > fora do expediente >
 * intervalo > bloqueio; o trecho de menor prioridade só mostra o que sobra.
 */
export function buildClosedSegments(params: {
  working: Interval | null;
  /** Folga/férias cobrindo o dia inteiro. */
  timeOff?: boolean;
  breakInterval?: Interval | null;
  blocks?: (Interval & { reason?: string | null })[];
}): ClosedSegment[] {
  if (params.timeOff) return [{ start: 0, end: DAY_MINUTES, reason: "Folga" }];
  if (!params.working) return [{ start: 0, end: DAY_MINUTES, reason: "Não atende neste dia" }];

  const ordered: ClosedSegment[] = [
    { start: 0, end: params.working.start, reason: "Fora do expediente" },
    { start: params.working.end, end: DAY_MINUTES, reason: "Fora do expediente" },
  ];
  if (params.breakInterval) ordered.push({ ...params.breakInterval, reason: "Intervalo" });
  for (const b of params.blocks ?? []) ordered.push({ start: b.start, end: b.end, reason: b.reason?.trim() || "Bloqueado" });

  const result: ClosedSegment[] = [];
  for (const seg of ordered) {
    for (const piece of subtractIntervals([seg], result)) result.push({ ...piece, reason: seg.reason });
  }
  return result.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
}

/** Trechos fechados em A *e* em B (usado na Semana: só tranca o que está fechado pra todos os barbeiros). */
export function intersectSegments(a: ClosedSegment[], b: ClosedSegment[]): ClosedSegment[] {
  const result: ClosedSegment[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (end > start) result.push({ start, end, reason: x.reason });
    }
  }
  return result.sort((p, q) => p.start - q.start);
}

/** O dia inteiro está fechado? */
export function coversWholeDay(segments: ClosedSegment[]): boolean {
  let covered = 0;
  for (const s of [...segments].sort((a, b) => a.start - b.start)) {
    if (s.start > covered) return false;
    covered = Math.max(covered, s.end);
  }
  return covered >= DAY_MINUTES;
}
