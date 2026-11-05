"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { previewRecurringDatesAction } from "@/actions/recurring-appointments";
import { buildSeriesDates, MAX_SERIES_DATES, RECURRING_FREQUENCY_PRESETS, type SeriesEnd } from "@/lib/recurring-helpers";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DatePreview } from "@/lib/recurring-preview";
import type { RecurringFrequencyUnit } from "@prisma/client";

type EndMode = "count" | "date" | "twoYears" | "manual";

export type RecurrenceValue = {
  frequencyUnit: RecurringFrequencyUnit;
  intervalValue: number;
  /** As datas foram marcadas uma a uma (sem intervalo fixo). */
  manualDates: boolean;
  /** Datas que serão de fato agendadas (AAAA-MM-DD): já sem as desmarcadas e sem as ocupadas. */
  dates: string[];
  /** Pode criar: há datas, nada pendente e a lista não passou do limite. */
  valid: boolean;
  /** Ainda conferindo a agenda — não envie agora. */
  checking: boolean;
  /** Quantas datas da frequência ficaram de fora por estarem ocupadas ou terem sido desmarcadas. */
  skippedCount: number;
};

const UNIT_LABEL: Record<RecurringFrequencyUnit, string> = { DAYS: "Dias", WEEKS: "Semanas", MONTHS: "Meses" };

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function labelDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y} · ${weekday}`;
}

/**
 * Frequência + até quando repetir (quantidade, data, 2 anos seguidos ou datas marcadas à mão) e a lista das
 * datas com a disponibilidade de cada uma. Datas em que o barbeiro já tem outro compromisso ficam de fora
 * automaticamente (sem criar "conflito"); dá para desmarcar qualquer data. `onChange` recebe o resultado final.
 */
export function RecurrenceFields({
  startDate,
  barberId,
  serviceId,
  startTime,
  onChange,
}: {
  startDate: string;
  barberId: string;
  serviceId: string;
  startTime: string;
  onChange: (value: RecurrenceValue) => void;
}) {
  const [presetKey, setPresetKey] = useState<string>(RECURRING_FREQUENCY_PRESETS[3].key); // "a cada 15 dias"
  const [isCustom, setIsCustom] = useState(false);
  const [customUnit, setCustomUnit] = useState<RecurringFrequencyUnit>("DAYS");
  const [customInterval, setCustomInterval] = useState(15);
  const [endMode, setEndMode] = useState<EndMode>("twoYears");
  const [endCount, setEndCount] = useState(10);
  const [endDateStr, setEndDateStr] = useState("");
  const [manualExtra, setManualExtra] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<Record<string, DatePreview>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);

  const preset = RECURRING_FREQUENCY_PRESETS.find((p) => p.key === presetKey);
  const unit: RecurringFrequencyUnit = isCustom ? customUnit : (preset?.unit ?? "DAYS");
  const interval = isCustom ? customInterval : (preset?.interval ?? 1);
  const manual = endMode === "manual";

  const { candidates, truncated } = useMemo(() => {
    if (!startDate) return { candidates: [] as string[], truncated: false };
    if (manual) {
      const all = Array.from(new Set([startDate, ...manualExtra])).sort();
      return { candidates: all, truncated: all.length > MAX_SERIES_DATES };
    }
    if (interval < 1) return { candidates: [] as string[], truncated: false };
    const start = new Date(`${startDate}T00:00:00.000Z`);
    let end: SeriesEnd;
    if (endMode === "count") end = { mode: "count", count: Math.max(1, endCount) };
    else if (endMode === "date") {
      if (!endDateStr || endDateStr < startDate) return { candidates: [] as string[], truncated: false };
      end = { mode: "date", endDate: new Date(`${endDateStr}T00:00:00.000Z`) };
    } else end = { mode: "twoYears" };
    const built = buildSeriesDates({ startDate: start, frequencyUnit: unit, intervalValue: interval, end });
    return { candidates: built.dates.map(toIso), truncated: built.truncated };
  }, [startDate, manual, manualExtra, endMode, endCount, endDateStr, unit, interval]);

  // Confere a agenda do barbeiro nessas datas (só as que ainda não foram conferidas para este barbeiro/serviço/horário).
  const contextKey = `${barberId}|${serviceId}|${startTime}`;
  const lastKey = useRef(contextKey);
  const canCheck = !!barberId && !!serviceId && /^\d{2}:\d{2}$/.test(startTime);
  useEffect(() => {
    if (lastKey.current !== contextKey) {
      lastKey.current = contextKey;
      setPreviews({});
    }
  }, [contextKey]);

  const missing = useMemo(() => (canCheck ? candidates.filter((d) => !previews[d]) : []), [canCheck, candidates, previews]);
  useEffect(() => {
    if (missing.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const batch = missing.slice(0, MAX_SERIES_DATES);
      const result = await previewRecurringDatesAction({ barberId, serviceId, startTime, dates: batch }).catch(() => null);
      if (cancelled) return;
      if (!result || !result.ok) {
        setPreviewError(result && !result.ok ? result.error : "Não foi possível conferir a agenda agora.");
        return;
      }
      setPreviewError(null);
      setPreviews((prev) => {
        if (lastKey.current !== contextKey) return prev;
        const next = { ...prev };
        for (const item of result.data!.items) next[item.date] = item;
        return next;
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [missing, barberId, serviceId, startTime, contextKey]);

  const checking = canCheck && missing.length > 0 && !previewError;

  const selected = useMemo(
    () => candidates.filter((d) => !excluded.has(d) && (!canCheck || previews[d]?.available === true)),
    [candidates, excluded, canCheck, previews]
  );

  const value = useMemo<RecurrenceValue>(
    () => ({
      frequencyUnit: manual ? "DAYS" : unit,
      intervalValue: manual ? 1 : interval,
      manualDates: manual,
      dates: selected,
      checking,
      skippedCount: candidates.length - selected.length,
      valid: canCheck && !checking && !previewError && !truncated && selected.length > 0 && (manual || interval >= 1),
    }),
    [manual, unit, interval, selected, checking, candidates.length, canCheck, previewError, truncated]
  );
  useEffect(() => onChange(value), [value, onChange]);

  function toggle(date: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function addManual() {
    if (!manualInput || manualInput < startDate) return;
    setManualExtra((prev) => (prev.includes(manualInput) ? prev : [...prev, manualInput]));
    setExcluded((prev) => {
      if (!prev.has(manualInput)) return prev;
      const next = new Set(prev);
      next.delete(manualInput);
      return next;
    });
    setManualInput("");
  }

  const radio = "flex flex-wrap items-center gap-2";

  return (
    <div className="space-y-4 rounded-xl border p-4">
      {!manual && (
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
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Até quando?</p>
        <div className="space-y-2 text-sm text-foreground-muted">
          <label className={radio}>
            <input type="radio" name="recurrence-end" checked={endMode === "twoYears"} onChange={() => setEndMode("twoYears")} />
            Marcar 2 anos seguidos
            <span className="text-xs">(acaba depois de 2 anos, não é infinito)</span>
          </label>
          <label className={radio}>
            <input type="radio" name="recurrence-end" checked={endMode === "count"} onChange={() => setEndMode("count")} />
            Quantidade de vezes (contando esta)
            <Input
              type="number"
              min={1}
              max={MAX_SERIES_DATES}
              value={endCount}
              onChange={(e) => setEndCount(Math.max(1, Number(e.target.value) || 1))}
              disabled={endMode !== "count"}
              className="w-20"
              aria-label="Quantidade de ocorrências"
            />
          </label>
          <label className={radio}>
            <input type="radio" name="recurrence-end" checked={endMode === "date"} onChange={() => setEndMode("date")} />
            Até uma data
            <Input type="date" value={endDateStr} min={startDate} onChange={(e) => setEndDateStr(e.target.value)} disabled={endMode !== "date"} aria-label="Data final da recorrência" />
          </label>
          <label className={radio}>
            <input type="radio" name="recurrence-end" checked={manual} onChange={() => setEndMode("manual")} />
            Escolher as datas manualmente
          </label>
        </div>
        {manual && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input type="date" value={manualInput} min={startDate} onChange={(e) => setManualInput(e.target.value)} aria-label="Adicionar data" className="w-auto" />
            <button
              type="button"
              onClick={addManual}
              disabled={!manualInput || manualInput < startDate}
              className="rounded-xl border border-secondary/60 px-3 py-1.5 text-xs text-secondary-light hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Adicionar data
            </button>
            <span className="text-xs text-foreground-muted">A data de início já está na lista.</span>
          </div>
        )}
      </div>

      {candidates.length > 0 && (
        <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
          <p className="mb-2 text-xs font-medium text-foreground-muted">
            {checking
              ? "Conferindo a agenda do barbeiro..."
              : canCheck
                ? `${selected.length} ${selected.length === 1 ? "data será marcada" : "datas serão marcadas"}${
                    candidates.length - selected.length > 0 ? ` · ${candidates.length - selected.length} de fora` : ""
                  }`
                : "Escolha cliente, barbeiro, serviço e horário para conferir a agenda."}
          </p>
          <ul className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 text-sm sm:grid-cols-2">
            {candidates.map((d) => {
              const p = previews[d];
              const busy = canCheck && p?.available === false;
              const checked = !excluded.has(d) && !busy;
              return (
                <li key={d} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${busy ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() => toggle(d)}
                    className="mt-1 h-4 w-4"
                    aria-label={`Marcar ${labelDate(d)}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={busy ? "text-foreground-muted line-through" : "text-foreground"}>{labelDate(d)}</span>
                    {busy && <span className="block text-xs text-amber-500">⚠ {p?.message ?? "Indisponível"} — fica de fora.</span>}
                  </span>
                  {manual && d !== startDate && (
                    <button
                      type="button"
                      onClick={() => setManualExtra((prev) => prev.filter((x) => x !== d))}
                      className="text-xs text-foreground-muted hover:text-danger"
                      aria-label={`Remover ${labelDate(d)}`}
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {truncated && <p className="text-xs text-danger">Muitas datas (máximo {MAX_SERIES_DATES}). Escolha um prazo menor.</p>}
      {previewError && <p className="text-xs text-danger">{previewError}</p>}
    </div>
  );
}
