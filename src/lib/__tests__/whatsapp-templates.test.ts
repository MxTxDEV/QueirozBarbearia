import { describe, expect, it } from "vitest";
import { appointmentScheduledByShopTemplate, morningReminderTemplate, recurringScheduledByShopTemplate } from "../whatsapp/templates";

const wall = (y: number, m: number, d: number, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h, min));

describe("templates de agendamento feito pela barbearia", () => {
  it("horário avulso", () => {
    const text = appointmentScheduledByShopTemplate({
      customerName: "João",
      companyName: "Queiroz Barbearia",
      date: "07/10/2026",
      time: "15:00",
      barberName: "Marcos",
      services: ["Corte", "Barba"],
      totalPrice: "80,00",
    });
    expect(text).toContain("A Queiroz Barbearia acabou de agendar um horário para você");
    expect(text).toContain("07/10/2026");
    expect(text).toContain("• Barba");
    expect(text).toContain("R$ 80,00");
  });

  it("horário + recorrência", () => {
    const text = recurringScheduledByShopTemplate({
      customerName: "João",
      companyName: "Queiroz Barbearia",
      serviceName: "Corte Social",
      barberName: "Marcos",
      frequencyLabel: "Toda semana",
      dates: [wall(2026, 10, 7, 15), wall(2026, 10, 14, 15)],
      moreCount: 3,
      conflictCount: 1,
    });
    expect(text).toContain("agendar seu horário e a sua recorrência");
    expect(text).toContain("• qua, 07/10 às 15:00");
    expect(text).toContain("• qua, 14/10 às 15:00");
    expect(text).toContain("e mais 3 data(s)");
    expect(text).toContain("1 data(s) não tinham vaga");
  });

  it("lembrete das 7h: um ou vários horários", () => {
    const one = morningReminderTemplate({
      customerName: "João",
      companyName: "Queiroz",
      items: [{ time: "15:00", barberName: "Marcos", services: ["Corte"] }],
    });
    expect(one).toContain("Bom dia, João!");
    expect(one).toContain("Você tem um horário marcado hoje");
    expect(one).toContain("⏰ 15:00 — Corte com Marcos");

    const many = morningReminderTemplate({
      customerName: "João",
      companyName: "Queiroz",
      items: [
        { time: "09:00", barberName: "Marcos", services: ["Corte"] },
        { time: "17:30", barberName: "Arthur", services: ["Barba", "Hidratação"] },
      ],
    });
    expect(many).toContain("Você tem horários marcados hoje");
    expect(many).toContain("⏰ 17:30 — Barba, Hidratação com Arthur");
  });
});
