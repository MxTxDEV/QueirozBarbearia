/**
 * Grade de horários que o CLIENTE vê ao agendar pelo link — parte PURA (sem banco), testável.
 *
 * O painel da barbearia continua oferecendo todos os horários de 15 em 15 minutos. Já o cliente vê só
 * uma sequência: "a cada N minutos" (padrão 45), contada a partir de uma hora de início escolhida pela
 * barbearia — ou, se não escolheu, a partir do início do expediente de cada barbeiro naquele dia.
 */

export const CUSTOMER_SLOT_STEP_DEFAULT = 45;
export const CUSTOMER_SLOT_STEP_MIN = 5;
export const CUSTOMER_SLOT_STEP_MAX = 240;

export type CustomerSlotConfig = {
  /** Intervalo entre um horário e o próximo, em minutos. */
  stepMin: number;
  /** "HH:MM" em que a contagem começa; null = no início do expediente de cada barbeiro. */
  startHHMM: string | null;
};

export const DEFAULT_CUSTOMER_SLOTS: CustomerSlotConfig = { stepMin: CUSTOMER_SLOT_STEP_DEFAULT, startHHMM: null };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isValidHHMM = (value: string) => HHMM.test(value);
export const hhmmToMin = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
export const minToHHMM = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Lê o que está salvo; valor ausente ou inválido volta ao padrão (45 min, início do expediente). */
export function normalizeCustomerSlotConfig(step: unknown, start: unknown): CustomerSlotConfig {
  const n = typeof step === "number" ? step : typeof step === "string" && step.trim() !== "" ? Number(step) : NaN;
  const stepMin = Number.isInteger(n) && n >= CUSTOMER_SLOT_STEP_MIN && n <= CUSTOMER_SLOT_STEP_MAX ? n : CUSTOMER_SLOT_STEP_DEFAULT;
  const startHHMM = typeof start === "string" && isValidHHMM(start.trim()) ? start.trim() : null;
  return { stepMin, startHHMM };
}

/** Minuto (desde 00:00) em que a contagem começa naquele dia. */
export function gridOriginMinutes(config: CustomerSlotConfig, dayStartMin: number): number {
  return config.startHHMM ? hhmmToMin(config.startHHMM) : dayStartMin;
}

/**
 * Primeiro horário da grade que cabe no expediente do dia. Se a contagem começa DEPOIS da abertura, nada
 * antes dela é oferecido ao cliente; se começa ANTES (ou na própria abertura), segue a mesma sequência
 * até o primeiro ponto que cai dentro do expediente.
 */
export function firstGridMinute(config: CustomerSlotConfig, dayStartMin: number): number {
  const origin = gridOriginMinutes(config, dayStartMin);
  if (origin >= dayStartMin) return origin;
  return origin + Math.ceil((dayStartMin - origin) / config.stepMin) * config.stepMin;
}

/** Esse horário de início está na grade do cliente? (usado também para barrar pedido fora da grade no servidor) */
export function isOnCustomerGrid(startMin: number, dayStartMin: number, config: CustomerSlotConfig): boolean {
  const origin = gridOriginMinutes(config, dayStartMin);
  if (startMin < origin) return false;
  return (startMin - origin) % config.stepMin === 0;
}

/** Primeiros horários da grade, para a prévia na tela de configuração. */
export function customerSlotExamples(config: CustomerSlotConfig, fallbackDayStart = "08:00", count = 6): string[] {
  const dayStartMin = hhmmToMin(fallbackDayStart);
  const out: string[] = [];
  for (let minute = firstGridMinute(config, dayStartMin); out.length < count && minute < 24 * 60; minute += config.stepMin) out.push(minToHHMM(minute));
  return out;
}
