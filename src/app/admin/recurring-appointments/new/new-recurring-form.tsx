"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRecurringAppointmentAsAdminAction } from "@/actions/recurring-appointments";
import { generateOccurrenceDates, RECURRING_FREQUENCY_PRESETS } from "@/lib/recurring-helpers";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { RecurringFrequencyUnit } from "@prisma/client";

type Service = { id: string; name: string; durationMinutes: number; price: number };
type Barber = { id: string; name: string; services: Service[] };
type Customer = { id: string; fullName: string; whatsapp: string };
type EndMode = "count" | "date" | "none";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function NewRecurringForm({ barbers, customers }: { barbers: Barber[]; customers: Customer[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("18:00");
  const [presetKey, setPresetKey] = useState(RECURRING_FREQUENCY_PRESETS[3].key); // "a cada 15 dias" como padrão sensato
  const [isCustom, setIsCustom] = useState(false);
  const [customUnit, setCustomUnit] = useState<RecurringFrequencyUnit>("DAYS");
  const [customInterval, setCustomInterval] = useState(15);
  const [endMode, setEndMode] = useState<EndMode>("count");
  const [endCount, setEndCount] = useState(10);
  const [endDateStr, setEndDateStr] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const preset = RECURRING_FREQUENCY_PRESETS.find((p) => p.key === presetKey);
  const unit: RecurringFrequencyUnit = isCustom ? customUnit : (preset?.unit ?? "DAYS");
  const interval = isCustom ? customInterval : (preset?.interval ?? 1);

  const previewDates = useMemo(() => {
    if (!startDate) return [];
    return generateOccurrenceDates({
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      frequencyUnit: unit,
      intervalValue: interval,
      occurrencesLimit: endMode === "count" ? endCount : 6,
      endDate: endMode === "date" && endDateStr ? new Date(`${endDateStr}T00:00:00.000Z`) : null,
      maxCount: 6,
    }).map((r) => r.date);
  }, [startDate, unit, interval, endMode, endCount, endDateStr]);

  function submit() {
    setError(null);
    if (!customerId || !barberId || !serviceId) {
      setError("Preencha cliente, barbeiro e serviço.");
      return;
    }
    startTransition(async () => {
      const result = await createRecurringAppointmentAsAdminAction({
        customerId,
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
        return;
      }
      router.push(`/admin/recurring-appointments/${result.data!.id}`);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Selecione um cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.whatsapp}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Barbeiro</Label>
            <Select
              value={barberId}
              onChange={(e) => {
                setBarberId(e.target.value);
                setServiceId("");
              }}
            >
              <option value="">Selecione um barbeiro</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {barber && (
          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Selecione um serviço</option>
              {barber.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes}min)
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Data de início</Label>
            <Input type="date" value={startDate} min={todayIso()} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Horário</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Frequência</Label>
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
                <option value="DAYS">Dias</option>
                <option value="WEEKS">Semanas</option>
                <option value="MONTHS">Meses</option>
              </Select>
            </div>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Até quando?</Label>
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

        {previewDates.length > 0 && (
          <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
            <p className="mb-2 text-xs font-medium text-foreground-muted">Próximas datas</p>
            <div className="flex flex-wrap gap-2 text-sm text-foreground">
              {previewDates.map((d) => (
                <span key={d.toISOString()} className="rounded-lg border px-2 py-1">
                  {formatDate(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={submit} disabled={pending}>
          {pending ? "Criando..." : "Criar recorrência"}
        </Button>
      </CardContent>
    </Card>
  );
}
