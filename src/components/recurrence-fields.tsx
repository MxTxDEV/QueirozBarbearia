"use client";

import { useEffect, useMemo, useState } from "react";
import { generateOccurrenceDates, RECURRING_FREQUENCY_PRESETS } from "@/lib/recurring-helpers";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { RecurringFrequencyUnit } from "@prisma/client";

type EndMode = "count" | "date" | "none";

export type RecurrenceValue = {
  frequencyUnit: RecurringFrequencyUnit;
  intervalValue: number;
  /** YYYY-MM-DD ou nulo. */
  endDate: string | null;
  occurrencesLimit: number | null;
  /** Os campos formam uma recorrência válida (ex.: "até uma data" sem data = inválido). */
  valid: boolean;
};

const UNIT_LABEL: Record<RecurringFrequencyUnit, string> = { DAYS: "Dias", WEEKS: "Semanas", MONTHS: "Meses" };

/**
 * Escolha de frequência + até quando repetir + prévia das próximas datas.
 * Devolve o valor pelo `onChange` (a cada mudança), pra quem usa montar a
 * chamada da action de recorrência. Mesmas regras das demais telas de
 * recorrência (presets, "mensal" de calendário, fim por quantidade/data).
 */
export function RecurrenceFields({ startDate, onChange }: { startDate: string; onChange: (value: RecurrenceValue) => void }) {
  const [presetKey, setPresetKey] = useState<string>(RECURRING_FREQUENCY_PRESETS[3].key); // "a cada 15 dias"
  const [isCustom, setIsCustom] = useState(false);
  const [customUnit, setCustomUnit] = useState<RecurringFrequencyUnit>("DAYS");
  const [customInterval, setCustomInterval] = useState(15);
  const [endMode, setEndMode] = useState<EndMode>("count");
  const [endCount, setEndCount] = useState(10);
  const [endDateStr, setEndDateStr] = useState("");

  const preset = RECURRING_FREQUENCY_PRESETS.find((p) => p.key === presetKey);
  const unit: RecurringFrequencyUnit = isCustom ? customUnit : (preset?.unit ?? "DAYS");
  const interval = isCustom ? customInterval : (preset?.interval ?? 1);

  const value = useMemo<RecurrenceValue>(
    () => ({
      frequencyUnit: unit,
      intervalValue: interval,
      endDate: endMode === "date" && endDateStr ? endDateStr : null,
      occurrencesLimit: endMode === "count" ? endCount : null,
      valid: interval >= 1 && (endMode !== "count" || endCount >= 1) && (endMode !== "date" || (!!endDateStr && endDateStr >= startDate)),
    }),
    [unit, interval, endMode, endDateStr, endCount, startDate]
  );
  useEffect(() => onChange(value), [value, onChange]);

  const previewDates = useMemo(() => {
    if (!startDate || interval < 1) return [];
    return generateOccurrenceDates({
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      frequencyUnit: unit,
      intervalValue: interval,
      occurrencesLimit: endMode === "count" ? endCount : 6,
      endDate: endMode === "date" && endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null,
      maxCount: 6,
    }).map((r) => r.date);
  }, [startDate, unit, interval, endMode, endCount, endDateStr]);

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Repetir</p>
        <div className="flex flex-wrap gap-2">
          {RECURRING_FREQUENCY_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setIsCustom(false);
                setPresetKey(p.key);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                !isCustom && presetKey === p.key
                  ? "border-secondary bg-secondary/20 text-foreground"
                  : "bg-[var(--surface-subtle)] text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={`rounded-xl border px-3 py-1.5 text-xs transition-colors ${
              isCustom ? "border-secondary bg-secondary/20 text-foreground" : "bg-[var(--surface-subtle)] text-foreground-muted"
            }`}
          >
            Personalizado
          </button>
        </div>
        {isCustom && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-foreground-muted">A cada</span>
            <Input
              type="number"
              min={1}
              max={365}
              value={customInterval}
              onChange={(e) => setCustomInterval(Math.max(1, Number(e.target.value) || 1))}
              className="w-20"
              aria-label="Intervalo da recorrência"
            />
            <Select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as RecurringFrequencyUnit)} className="w-auto" aria-label="Unidade da recorrência">
              {(Object.keys(UNIT_LABEL) as RecurringFrequencyUnit[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Até quando?</p>
        <div className="space-y-2 text-sm text-foreground-muted">
          <label className="flex flex-wrap items-center gap-2">
            <input type="radio" name="recurrence-end" checked={endMode === "count"} onChange={() => setEndMode("count")} />
            Quantidade de vezes (contando esta)
            <Input
              type="number"
              min={1}
              max={104}
              value={endCount}
              onChange={(e) => setEndCount(Math.max(1, Number(e.target.value) || 1))}
              disabled={endMode !== "count"}
              className="w-20"
              aria-label="Quantidade de ocorrências"
            />
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <input type="radio" name="recurrence-end" checked={endMode === "date"} onChange={() => setEndMode("date")} />
            Até uma data
            <Input type="date" value={endDateStr} min={startDate} onChange={(e) => setEndDateStr(e.target.value)} disabled={endMode !== "date"} aria-label="Data final da recorrência" />
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="recurrence-end" checked={endMode === "none"} onChange={() => setEndMode("none")} />
            Sem data final
          </label>
        </div>
      </div>

      {previewDates.length > 0 && (
        <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
          <p className="mb-2 text-xs font-medium text-foreground-muted">Próximas datas</p>
          <div className="flex flex-wrap gap-2 text-sm text-foreground">
            {previewDates.map((d) => (
              <span key={d.toISOString()} className="rounded-lg border px-2 py-1">
                {formatDate(d)}
              </span>
            ))}
            {endMode === "none" && <span className="self-center text-xs text-foreground-muted">e assim por diante...</span>}
          </div>
        </div>
      )}
    </div>
  );
}
