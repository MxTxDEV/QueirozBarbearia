/**
 * Aviso mensal de recorrência — parte pura (sem banco, sem "server-only"), testável.
 * Os horários de agendamento são "relógio de parede gravado em UTC" (ver shop-time.ts),
 * então tudo aqui lê os campos em UTC.
 */

/** O aviso só sai nos primeiros dias do mês (dia 1 é o alvo; 2 e 3 cobrem uma falha do agendador). */
export const NOTICE_LAST_DAY_OF_MONTH = 3;
/** Janela do dia (relógio da barbearia) em que o aviso pode sair — nada de mensagem de madrugada. */
export const NOTICE_FIRST_HOUR = 9;
export const NOTICE_LAST_HOUR = 19;

/** Chave do mês, ex: "2026-10". */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "Outubro de 2026". */
export function monthLabelPt(date: Date): string {
  const name = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "UTC",
  });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${date.getUTCFullYear()}`;
}

/** `now` = relógio de parede da barbearia (shopNow). */
export function isNoticeWindow(now: Date): boolean {
  const day = now.getUTCDate();
  const hour = now.getUTCHours();
  return day <= NOTICE_LAST_DAY_OF_MONTH && hour >= NOTICE_FIRST_HOUR && hour < NOTICE_LAST_HOUR;
}

/** Primeiro e último instante do mês de `now`, como relógio de parede em UTC. */
export function monthBounds(now: Date): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 1)) };
}

/** "sex, 09/10 às 15:00". */
export function formatNoticeDate(start: Date): string {
  const weekday = start.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const day = String(start.getUTCDate()).padStart(2, "0");
  const month = String(start.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(start.getUTCHours()).padStart(2, "0");
  const mm = String(start.getUTCMinutes()).padStart(2, "0");
  return `${weekday}, ${day}/${month} às ${hh}:${mm}`;
}

export type NoticeSeries = {
  serviceName: string;
  barberName: string;
  frequencyLabel: string;
  /** Início de cada data ainda por vir neste mês (ordenado). */
  dates: Date[];
};

/** Um horário marcado fora de recorrência (corte avulso). */
export type NoticeSingle = { start: Date; serviceName: string; barberName: string };

/** Bloco "horários" do resumo do mês: recorrências agrupadas e, à parte, os avulsos. */
export function monthlyHorarios(series: NoticeSeries[], singles: NoticeSingle[] = []): string {
  const blocks = series.map((s) => {
    const dates = s.dates.map((date) => `• ${formatNoticeDate(date)}`).join("\n");
    return `✂️ ${s.serviceName} com ${s.barberName}\n🔁 ${s.frequencyLabel}\n${dates}`;
  });
  if (singles.length > 0) {
    const lines = singles.map((x) => `• ${formatNoticeDate(x.start)} — ${x.serviceName} com ${x.barberName}`).join("\n");
    blocks.push(`📅 ${series.length > 0 ? "Outros horários marcados" : "Horários marcados"}\n${lines}`);
  }
  return blocks.join("\n\n");
}

export type MonthlyMessageData = {
  customerName: string;
  companyName: string;
  monthLabel: string;
  series: NoticeSeries[];
  singles?: NoticeSingle[];
};

/** Valores (`{nome}`, `{mes}`, `{horarios}`…) do resumo do mês. */
export function monthlyVars(d: MonthlyMessageData) {
  return { nome: d.customerName, barbearia: d.companyName, mes: d.monthLabel, horarios: monthlyHorarios(d.series, d.singles) };
}
