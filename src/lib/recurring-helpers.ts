/**
 * Funções puras (sem acesso a banco) do motor de recorrência — mesma
 * separação de src/lib/availability-helpers.ts e src/lib/waitlist-helpers.ts,
 * pelo mesmo motivo: testáveis direto, sem "server-only".
 *
 * Toda aritmética de data é feita explicitamente em UTC (Date.UTC), nunca
 * com os métodos locais do date-fns (que já é dependência do projeto, mas
 * usa getFullYear/getMonth do fuso do processo) — mantém a mesma garantia
 * contra bugs de fuso do servidor que o resto do código já segue (ver
 * timeOnDate/dateOnly em availability-helpers.ts).
 */
import type { RecurringFrequencyUnit } from "@prisma/client";

/** Meses sem data final geram ocorrências só até este horizonte rolante (Regra 28). */
export const RECURRING_GENERATION_HORIZON_MONTHS = 3;

/** Trava de segurança contra geração desenfreada — nunca deveria ser atingida em uso normal. */
const MAX_OCCURRENCES_PER_GENERATION = 400;

export function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Soma meses em UTC tratando corretamente meses mais curtos: 31/01 + 1 mês
 * vira 28/02 (ou 29/02 em ano bissexto), nunca "03/03" (o bug clássico de
 * `setMonth` estourando pro mês seguinte). Preserva hora/minuto/segundo.
 */
export function addUtcMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetMonthIndex = month + months;
  // Dia 0 do mês seguinte ao alvo = último dia do mês alvo.
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);
  return new Date(
    Date.UTC(
      year,
      targetMonthIndex,
      clampedDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

export function addUtcWeeks(date: Date, weeks: number): Date {
  return addUtcDays(date, weeks * 7);
}

/**
 * Data da N-ésima ocorrência (n=0 é a própria data de início). MONTHS usa
 * regra de calendário (mesmo dia do mês, com clamping); DAYS/WEEKS usam
 * intervalo real de dias — "a cada 30 dias" nunca é igual a "mensal"
 * (Regra 11).
 */
export function nthOccurrenceDate(startDate: Date, unit: RecurringFrequencyUnit, interval: number, n: number): Date {
  if (unit === "DAYS") return addUtcDays(startDate, interval * n);
  if (unit === "WEEKS") return addUtcWeeks(startDate, interval * n);
  return addUtcMonthsClamped(startDate, interval * n);
}

export type GenerateOccurrencesParams = {
  startDate: Date;
  frequencyUnit: RecurringFrequencyUnit;
  intervalValue: number;
  /** Índice (0-based) a partir do qual gerar — usado na geração progressiva pra continuar de onde parou. */
  startIndex?: number;
  /** Condição de término por data — Regra 10 (quantidade e data final: o que vier primeiro). */
  endDate?: Date | null;
  /** Condição de término por quantidade. */
  occurrencesLimit?: number | null;
  /** Horizonte da geração progressiva (séries sem fim definido) — Regra 28/29. */
  horizonDate?: Date | null;
  maxCount?: number;
};

/**
 * Gera as datas de ocorrência respeitando, nesta ordem, o que vier
 * primeiro: occurrencesLimit, endDate, horizonDate, ou a trava de
 * segurança maxCount. Série finita (limit e/ou endDate) → chame sem
 * horizonDate pra gerar tudo de uma vez. Série sem fim → chame com
 * horizonDate (e startIndex/generatedUntil) pra gerar só o próximo lote.
 */
export function generateOccurrenceDates(params: GenerateOccurrencesParams): { occurrenceIndex: number; date: Date }[] {
  const {
    startDate,
    frequencyUnit,
    intervalValue,
    startIndex = 0,
    endDate,
    occurrencesLimit,
    horizonDate,
    maxCount = MAX_OCCURRENCES_PER_GENERATION,
  } = params;

  const results: { occurrenceIndex: number; date: Date }[] = [];
  for (let n = startIndex; results.length < maxCount; n++) {
    if (occurrencesLimit != null && n >= occurrencesLimit) break;
    const date = nthOccurrenceDate(startDate, frequencyUnit, intervalValue, n);
    if (endDate && date.getTime() > endDate.getTime()) break;
    if (horizonDate && date.getTime() > horizonDate.getTime()) break;
    results.push({ occurrenceIndex: n, date });
  }
  return results;
}

export type RecurringFrequencyPreset = {
  key: string;
  label: string;
  unit: RecurringFrequencyUnit;
  interval: number;
};

/** Atalhos apresentados na tela do cliente (Regra 9) — "Personalizado" é o fallback fora desta lista. */
export const RECURRING_FREQUENCY_PRESETS: RecurringFrequencyPreset[] = [
  { key: "weekly", label: "Toda semana", unit: "WEEKS", interval: 1 },
  { key: "every_7", label: "A cada 7 dias", unit: "DAYS", interval: 7 },
  { key: "every_14", label: "A cada 14 dias", unit: "DAYS", interval: 14 },
  { key: "every_15", label: "A cada 15 dias", unit: "DAYS", interval: 15 },
  { key: "every_21", label: "A cada 21 dias", unit: "DAYS", interval: 21 },
  { key: "every_30", label: "A cada 30 dias", unit: "DAYS", interval: 30 },
  { key: "monthly", label: "Uma vez por mês", unit: "MONTHS", interval: 1 },
];

const UNIT_LABEL_SINGULAR: Record<RecurringFrequencyUnit, string> = { DAYS: "dia", WEEKS: "semana", MONTHS: "mês" };
const UNIT_LABEL_PLURAL: Record<RecurringFrequencyUnit, string> = { DAYS: "dias", WEEKS: "semanas", MONTHS: "meses" };

/** Descrição legível da frequência, usada no painel admin, notificações e templates de WhatsApp. */
export function describeFrequency(unit: RecurringFrequencyUnit, interval: number): string {
  const preset = RECURRING_FREQUENCY_PRESETS.find((p) => p.unit === unit && p.interval === interval);
  if (preset) return preset.label;
  if (interval === 1) return `Toda(o) ${UNIT_LABEL_SINGULAR[unit]}`;
  return `A cada ${interval} ${UNIT_LABEL_PLURAL[unit]}`;
}
