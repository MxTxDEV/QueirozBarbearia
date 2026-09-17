"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { requestRecurringAppointmentAsCustomerAction } from "@/actions/recurring-appointments";
import { generateOccurrenceDates, RECURRING_FREQUENCY_PRESETS, type RecurringFrequencyPreset } from "@/lib/recurring-helpers";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { RecurringFrequencyUnit } from "@prisma/client";

type EndMode = "count" | "date" | "none";
const UNIT_LABEL: Record<RecurringFrequencyUnit, string> = { DAYS: "Dias", WEEKS: "Semanas", MONTHS: "Meses" };

export function RecurringRequestPanel({
  barberId,
  serviceId,
  startDate,
  startTime,
  onSuccess,
}: {
  barberId: string;
  serviceId: string;
  startDate: string;
  startTime: string;
  onSuccess: () => void;
}) {
  const [presetKey, setPresetKey] = useState<string>(RECURRING_FREQUENCY_PRESETS[3].key); // "a cada 15 dias" como padrão sensato
  const [isCustom, setIsCustom] = useState(false);
  const [customUnit, setCustomUnit] = useState<RecurringFrequencyUnit>("DAYS");
  const [customInterval, setCustomInterval] = useState(15);
  const [endMode, setEndMode] = useState<EndMode>("count");
  const [endCount, setEndCount] = useState(10);
  const [endDateStr, setEndDateStr] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const preset: RecurringFrequencyPreset | undefined = RECURRING_FREQUENCY_PRESETS.find((p) => p.key === presetKey);
  const unit: RecurringFrequencyUnit = isCustom ? customUnit : (preset?.unit ?? "DAYS");
  const interval = isCustom ? customInterval : (preset?.interval ?? 1);

  const previewDates = useMemo(() => {
    if (!startDate || interval < 1) return [];
    const start = new Date(`${startDate}T00:00:00.000Z`);
    return generateOccurrenceDates({
      startDate: start,
      frequencyUnit: unit,
      intervalValue: interval,
      occurrencesLimit: endMode === "count" ? endCount : 6,
      endDate: endMode === "date" && endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null,
      maxCount: 6,
    }).map((r) => r.date);
  }, [startDate, unit, interval, endMode, endCount, endDateStr]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await requestRecurringAppointmentAsCustomerAction({
        barberId,
        serviceId,
        startDate,
        startTime,
        frequencyUnit: unit,
        intervalValue: interval,
        endDate: endMode === "date" && endDateStr ? endDateStr : null,
        occurrencesLimit: endMode === "count" ? endCount : null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setSubmitted(true);
      toast.success("Recorrência solicitada!");
      onSuccess();
    });
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-foreground">
        Sua solicitação de recorrência foi enviada ao barbeiro e aguarda confirmação. Acompanhe em &quot;Minhas
        recorrências&quot;.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Frequência</p>
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
            <span className="text-sm text-foreground-muted">Repetir a cada</span>
            <Input
              type="number"
              min={1}
              max={365}
              value={customInterval}
              onChange={(e) => setCustomInterval(Math.max(1, Number(e.target.value) || 1))}
              className="w-20"
            />
            <Select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as RecurringFrequencyUnit)} className="w-auto">
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
            <input type="radio" checked={endMode === "count"} onChange={() => setEndMode("count")} />
            Quantidade de ocorrências
            <Input
              type="number"
              min={1}
              max={104}
              value={endCount}
              onChange={(e) => setEndCount(Math.max(1, Number(e.target.value) || 1))}
              disabled={endMode !== "count"}
              className="w-20"
            />
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <input type="radio" checked={endMode === "date"} onChange={() => setEndMode("date")} />
            Até uma data
            <Input type="date" value={endDateStr} min={startDate} onChange={(e) => setEndDateStr(e.target.value)} disabled={endMode !== "date"} />
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={endMode === "none"} onChange={() => setEndMode("none")} />
            Sem data final
          </label>
        </div>
      </div>

      <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
        <p className="mb-2 text-xs font-medium text-foreground-muted">Próximos horários</p>
        <div className="flex flex-wrap gap-2 text-sm text-foreground">
          {previewDates.map((d) => (
            <span key={d.toISOString()} className="rounded-lg border px-2 py-1">
              {formatDate(d)}
            </span>
          ))}
          {endMode === "none" && <span className="text-xs text-foreground-muted">e assim por diante...</span>}
        </div>
      </div>

      <p className="text-xs text-warning">
        IMPORTANTE: esta recorrência precisa ser confirmada pelo barbeiro antes de virar agendamentos de verdade.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={submit} disabled={pending} className="w-full">
        {pending ? "Enviando..." : "Solicitar recorrência"}
      </Button>
    </div>
  );
}
