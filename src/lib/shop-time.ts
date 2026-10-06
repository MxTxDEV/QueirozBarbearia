/**
 * Relógio da barbearia.
 *
 * Os horários de agendamento são guardados como "horário de parede" gravado
 * em UTC (14:00 no Brasil vira 14:00Z — ver availability-helpers.ts). Então
 * qualquer comparação do tipo "já passou?" / "que dia é hoje?" precisa usar
 * o mesmo referencial: o relógio de parede da barbearia expresso em UTC. Usar
 * `new Date()` direto compara com o relógio REAL do servidor (UTC), que no
 * Brasil (UTC-3) está 3h adiantado — o que fazia, por exemplo, os horários de
 * hoje antes das 17h parecerem "passados" às 14h.
 *
 * Sem dependências de servidor: serve também no navegador (a hora vem sempre
 * do fuso da barbearia, nunca do fuso do aparelho de quem está olhando).
 */
const SHOP_TIMEZONE = "America/Sao_Paulo";

/** Instante `at` (padrão: agora) como relógio de parede da barbearia, expresso em UTC. */
export function shopNow(at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")));
}

/** Data de hoje (YYYY-MM-DD) na barbearia. */
export function shopTodayIso(at: Date = new Date()): string {
  return shopNow(at).toISOString().slice(0, 10);
}
