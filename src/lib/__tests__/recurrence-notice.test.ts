import { describe, expect, it } from "vitest";
import {
  formatNoticeDate,
  isNoticeWindow,
  monthBounds,
  monthKey,
  monthLabelPt,
} from "../recurrence-notice";
import { monthlyRecurrenceMessage } from "../whatsapp/templates";

const wall = (y: number, m: number, d: number, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h, min));

describe("recurrence-notice", () => {
  it("monthKey / monthLabelPt", () => {
    expect(monthKey(wall(2026, 10, 1))).toBe("2026-10");
    expect(monthKey(wall(2026, 1, 31))).toBe("2026-01");
    expect(monthLabelPt(wall(2026, 10, 15))).toBe("Outubro de 2026");
    expect(monthLabelPt(wall(2027, 3, 1))).toBe("Março de 2027");
  });

  it("isNoticeWindow: só nos 3 primeiros dias, das 9h às 19h", () => {
    expect(isNoticeWindow(wall(2026, 11, 1, 9, 0))).toBe(true);
    expect(isNoticeWindow(wall(2026, 11, 1, 18, 59))).toBe(true);
    expect(isNoticeWindow(wall(2026, 11, 3, 12))).toBe(true);
    expect(isNoticeWindow(wall(2026, 11, 1, 8, 59))).toBe(false);
    expect(isNoticeWindow(wall(2026, 11, 1, 19, 0))).toBe(false);
    expect(isNoticeWindow(wall(2026, 11, 1, 0, 5))).toBe(false);
    expect(isNoticeWindow(wall(2026, 11, 4, 12))).toBe(false);
    expect(isNoticeWindow(wall(2026, 11, 15, 12))).toBe(false);
  });

  it("monthBounds cobre o mês inteiro", () => {
    const { start, end } = monthBounds(wall(2026, 12, 20, 10));
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("formatNoticeDate", () => {
    expect(formatNoticeDate(wall(2026, 10, 9, 15, 0))).toBe("sex, 09/10 às 15:00");
    expect(formatNoticeDate(wall(2026, 10, 12, 9, 5))).toBe("seg, 12/10 às 09:05");
  });

  it("monthlyRecurrenceMessage lista as datas de cada série", () => {
    const text = monthlyRecurrenceMessage({
      customerName: "André",
      companyName: "Queiroz Barbearia",
      monthLabel: "Outubro de 2026",
      series: [
        { serviceName: "Corte Social", barberName: "Rafael", frequencyLabel: "A cada 7 dias", dates: [wall(2026, 10, 9, 15), wall(2026, 10, 16, 15)] },
        { serviceName: "Barba", barberName: "Diego", frequencyLabel: "A cada 14 dias", dates: [wall(2026, 10, 10, 10)] },
      ],
    });
    expect(text).toContain("Olá, André!");
    expect(text).toContain("horários marcados em Outubro de 2026");
    expect(text).toContain("Queiroz Barbearia");
    expect(text).toContain("• sex, 09/10 às 15:00");
    expect(text).toContain("• sex, 16/10 às 15:00");
    expect(text).toContain("• sáb, 10/10 às 10:00");
    expect(text).toContain("Um dia antes");
  });

  it("monthlyRecurrenceMessage inclui horários avulsos, com ou sem recorrência", () => {
    const withSeries = monthlyRecurrenceMessage({
      customerName: "Ana",
      companyName: "Queiroz",
      monthLabel: "Outubro de 2026",
      series: [{ serviceName: "Corte", barberName: "Marcos", frequencyLabel: "Toda semana", dates: [wall(2026, 10, 9, 15)] }],
      singles: [{ start: wall(2026, 10, 20, 11, 30), serviceName: "Barba", barberName: "Arthur" }],
    });
    expect(withSeries).toContain("Outros horários marcados");
    expect(withSeries).toContain("• ter, 20/10 às 11:30 — Barba com Arthur");

    const onlySingles = monthlyRecurrenceMessage({
      customerName: "Ana",
      companyName: "Queiroz",
      monthLabel: "Outubro de 2026",
      series: [],
      singles: [{ start: wall(2026, 10, 20, 11, 30), serviceName: "Barba", barberName: "Arthur" }],
    });
    expect(onlySingles).toContain("📅 Horários marcados");
    expect(onlySingles).not.toContain("🔁");
  });
});
