import { describe, expect, it } from "vitest";
import { SCHEDULER_STALE_AFTER_MIN, describeAgo, schedulerHealth } from "../scheduler-health";

const NOW = new Date("2026-10-27T10:00:00.000Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);

describe("schedulerHealth", () => {
  it("nunca rodou", () => expect(schedulerHealth(null, NOW)).toEqual({ state: "never", minutesAgo: null }));
  it("em dia logo após rodar", () => expect(schedulerHealth(ago(1), NOW)).toEqual({ state: "ok", minutesAgo: 1 }));
  it("no limite ainda está em dia", () => expect(schedulerHealth(ago(SCHEDULER_STALE_AFTER_MIN), NOW).state).toBe("ok"));
  it("passou do limite: parado", () => expect(schedulerHealth(ago(SCHEDULER_STALE_AFTER_MIN + 1), NOW).state).toBe("stale"));
  it("relógio levemente adiantado não dá minutos negativos", () => expect(schedulerHealth(new Date(NOW.getTime() + 5_000), NOW).minutesAgo).toBe(0));
});

describe("describeAgo", () => {
  it("descreve o tempo em português", () => {
    expect(describeAgo(0)).toBe("agora há pouco");
    expect(describeAgo(7)).toBe("há 7 min");
    expect(describeAgo(180)).toBe("há 3 h");
    expect(describeAgo(60 * 24)).toBe("há 1 dia");
    expect(describeAgo(60 * 24 * 3)).toBe("há 3 dias");
  });
});
