import type { Interval } from "@/lib/quick-slots";

/** Tudo que o calendário precisa pra deixar o intervalo (almoço) de um barbeiro, num dia, ser movido. Serializável. */
export type BreakInfo = {
  barberId: string;
  barberName: string;
  /** YYYY-MM-DD */
  date: string;
  /** Intervalo atual, em minutos desde 00:00. */
  start: number;
  end: number;
  /** Expediente do dia — o intervalo não pode sair daqui. */
  workStart: number;
  workEnd: number;
  /** Agendamentos/HOLDs do dia — o intervalo não pode cair em cima. */
  busy: Interval[];
  /** O intervalo atual é uma exceção só deste dia (não o padrão da semana). */
  isOverride: boolean;
};
