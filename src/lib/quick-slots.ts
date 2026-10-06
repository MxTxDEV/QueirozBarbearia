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
