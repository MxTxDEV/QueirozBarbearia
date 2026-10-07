import { describe, expect, it } from "vitest";
import {
  AUTOMATION_KINDS,
  DEFAULT_RULES,
  KIND_DEFS,
  describeOffset,
  matchesAudience,
  pickRule,
  renderTemplate,
  sampleVars,
  templateFields,
  validateTemplate,
  whenLabel,
} from "../whatsapp/automation-defs";

describe("renderTemplate", () => {
  it("troca os campos e arruma o que sobrou de campo vazio", () => {
    expect(renderTemplate("Oi, {nome}! Hoje {quando}.", { nome: "Ana", quando: "amanhã" })).toBe("Oi, Ana! Hoje amanhã.");
    const text = renderTemplate("Linha 1\n\n{observacao}\n\nLinha 2", { observacao: "" });
    expect(text).toBe("Linha 1\n\nLinha 2");
    expect(renderTemplate("Total {a}{b}  fim", { a: 1, b: undefined })).toBe("Total 1 fim");
  });
});

describe("validateTemplate", () => {
  it("aceita campos do tipo, recusa desconhecidos, vazio e texto longo", () => {
    expect(validateTemplate("REMINDER_BEFORE", "Oi {nome}, {hora} com {barbeiro}")).toBeNull();
    expect(validateTemplate("REMINDER_BEFORE", "Oi {nome} {mes}")).toContain("{mes}");
    expect(validateTemplate("CANCELLATION", "   ")).toContain("Escreva");
    expect(validateTemplate("CANCELLATION", "x".repeat(1501))).toContain("passou de");
  });
  it("todo texto padrão só usa campos do próprio tipo", () => {
    for (const kind of AUTOMATION_KINDS) {
      const allowed = new Set(KIND_DEFS[kind].variables.map((v) => v.key));
      for (const field of templateFields(KIND_DEFS[kind].defaultTemplate)) {
        expect(allowed.has(field), `${kind} usa {${field}}`).toBe(true);
      }
      expect(validateTemplate(kind, KIND_DEFS[kind].defaultTemplate)).toBeNull();
    }
  });
  it("sampleVars preenche todos os campos", () => {
    const vars = sampleVars("REMINDER_BEFORE");
    expect(renderTemplate(KIND_DEFS.REMINDER_BEFORE.defaultTemplate, vars)).not.toContain("{");
  });
});

describe("regras padrão", () => {
  it("existe ao menos uma regra de cada tipo e as chaves são únicas", () => {
    for (const kind of AUTOMATION_KINDS) expect(DEFAULT_RULES.some((r) => r.kind === kind)).toBe(true);
    const keys = DEFAULT_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("describeOffset / whenLabel", () => {
  it("descreve o tempo", () => {
    expect(describeOffset(1440)).toBe("1 dia antes");
    expect(describeOffset(2880)).toBe("2 dias antes");
    expect(describeOffset(120)).toBe("2 horas antes");
    expect(describeOffset(60)).toBe("1 hora antes");
    expect(describeOffset(45)).toBe("45 minutos antes");
    expect(whenLabel(0, "09/10/2026")).toBe("hoje");
    expect(whenLabel(1, "09/10/2026")).toBe("amanhã");
    expect(whenLabel(3, "09/10/2026")).toBe("no dia 09/10/2026");
  });
});

describe("público e escolha da regra", () => {
  const newbie = { recurring: false, hasCompleted: false };
  const regular = { recurring: true, hasCompleted: true };
  it("matchesAudience", () => {
    expect(matchesAudience("ALL", newbie)).toBe(true);
    expect(matchesAudience("RECURRING", newbie)).toBe(false);
    expect(matchesAudience("RECURRING", regular)).toBe(true);
    expect(matchesAudience("NON_RECURRING", regular)).toBe(false);
    expect(matchesAudience("NEW", newbie)).toBe(true);
    expect(matchesAudience("NEW", regular)).toBe(false);
    expect(matchesAudience("RETURNING", regular)).toBe(true);
  });
  it("pickRule: o público específico ganha de 'todos'; desligada não conta", () => {
    const all = { id: "all", enabled: true, audience: "ALL", sortOrder: 0 };
    const rec = { id: "rec", enabled: true, audience: "RECURRING", sortOrder: 1 };
    expect(pickRule([all, rec], regular)?.id).toBe("rec");
    expect(pickRule([all, rec], newbie)?.id).toBe("all");
    expect(pickRule([{ ...all, enabled: false }, rec], newbie)).toBeNull();
    expect(pickRule([all, { ...rec, enabled: false }], regular)?.id).toBe("all");
    expect(pickRule([], regular)).toBeNull();
  });
});
