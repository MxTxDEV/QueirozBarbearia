import { describe, expect, it } from "vitest";
import { gridHourBounds } from "@/app/admin/appointments/calendar/calendar-dates";

const wall = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 24, h, m));

describe("gridHourBounds", () => {
  it("sem agendamentos mostra das 05h às 22h", () => {
    expect(gridHourBounds([])).toEqual({ startHour: 5, endHour: 22 });
  });

  it("agendamento dentro da janela não muda nada", () => {
    expect(gridHourBounds([{ startTime: wall(7), endTime: wall(8) }])).toEqual({ startHour: 5, endHour: 22 });
  });

  it("expande se algum agendamento ficar fora da janela", () => {
    expect(gridHourBounds([{ startTime: wall(4, 30), endTime: wall(5, 30) }, { startTime: wall(21), endTime: wall(22, 30) }])).toEqual({ startHour: 4, endHour: 23 });
  });
});
