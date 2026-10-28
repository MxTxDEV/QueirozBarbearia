import { describe, expect, it } from "vitest";
import { appointmentReminderTemplate, appointmentScheduledByShopTemplate, morningReminderTemplate, recurringScheduledByShopTemplate } from "../whatsapp/templates";
import { ensureObservation } from "../whatsapp/automation-defs";

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

  it("lembrete da manhã leva o link de confirmação (um ou vários horários)", () => {
    const one = morningReminderTemplate({
      customerName: "João",
      companyName: "Queiroz",
      items: [{ time: "15:00", barberName: "Marcos", services: ["Corte"], confirmUrl: "https://x.com/confirmar/aaa" }],
    });
    expect(one).toContain("✅ Confirme seu horário com um toque:\nhttps://x.com/confirmar/aaa");

    const many = morningReminderTemplate({
      customerName: "João",
      companyName: "Queiroz",
      items: [
        { time: "09:00", barberName: "Marcos", services: ["Corte"], confirmUrl: "https://x.com/confirmar/aaa" },
        { time: "17:30", barberName: "Arthur", services: ["Barba"], confirmUrl: "https://x.com/confirmar/bbb" },
      ],
    });
    expect(many).toContain("⏰ 09:00 → https://x.com/confirmar/aaa");
    expect(many).toContain("⏰ 17:30 → https://x.com/confirmar/bbb");

    const none = morningReminderTemplate({
      customerName: "João",
      companyName: "Queiroz",
      items: [{ time: "15:00", barberName: "Marcos", services: ["Corte"] }],
    });
    expect(none).not.toContain("Confirme");
    expect(none).not.toContain("\n\n\n");
  });
});

describe("observação do agendamento nos lembretes", () => {
  const base = { customerName: "João", companyName: "Queiroz", date: "07/10/2026", time: "15:00", barberName: "Marcos", services: ["Corte"], totalPrice: "45,00" };

  it("lembrete antes do horário mostra a observação", () => {
    const text = appointmentReminderTemplate({ ...base, notes: "corte do filho Pedro", when: "amanhã" });
    expect(text).toContain("📝 Observação: corte do filho Pedro");
  });
  it("sem observação, o lembrete não ganha linha vazia nem o rótulo", () => {
    const text = appointmentReminderTemplate({ ...base, notes: null, when: "amanhã" });
    expect(text).not.toContain("Observação");
    expect(text).not.toMatch(/\n{3,}/);
  });
  it("observação com quebras de linha vira uma linha só", () => {
    expect(appointmentReminderTemplate({ ...base, notes: "corte\ndo filho\n  Pedro", when: "hoje" })).toContain("📝 Observação: corte do filho Pedro");
  });
  it("lembrete da manhã traz a observação de cada horário", () => {
    const text = morningReminderTemplate({
      customerName: "João",
      companyName: "Queiroz",
      items: [
        { time: "09:00", barberName: "Marcos", services: ["Corte"], notes: "corte do filho Pedro" },
        { time: "15:00", barberName: "Marcos", services: ["Barba"] },
      ],
    });
    expect(text).toContain("⏰ 09:00 — Corte com Marcos\n📝 Observação: corte do filho Pedro");
    expect(text).toContain("⏰ 15:00 — Barba com Marcos");
    expect(text.match(/Observação/g)).toHaveLength(1);
  });
});

describe("ensureObservation (texto personalizado sem o campo)", () => {
  const note = "📝 Observação: corte do filho Pedro";
  it("acrescenta no fim quando o texto não usa {observacao}", () => {
    expect(ensureObservation("Olá! Seu horário é amanhã.", "Olá! Seu horário é {quando}.", note)).toBe(`Olá! Seu horário é amanhã.\n\n${note}`);
  });
  it("não repete quando o texto já usa {observacao}", () => {
    expect(ensureObservation(`Oi\n${note}`, "Oi\n{observacao}", note)).toBe(`Oi\n${note}`);
  });
  it("sem observação, não muda nada", () => {
    expect(ensureObservation("Oi", "Oi", "")).toBe("Oi");
    expect(ensureObservation("Oi", "Oi", undefined)).toBe("Oi");
  });
});
