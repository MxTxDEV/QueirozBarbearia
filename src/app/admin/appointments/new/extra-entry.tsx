"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { getAvailableSlotsForAdminAction } from "@/actions/availability";
import { shopNow } from "@/lib/shop-time";

type Service = { id: string; name: string; price: number; durationMinutes: number };
type Barber = { id: string; name: string; services: Service[] };
type Slot = { iso: string; label: string };

/** Um horário a mais na mesma marcação (ex: o filho logo depois do pai). Quem manda no estado é o formulário. */
export type ExtraBooking = {
  key: string;
  barberId: string;
  serviceIds: string[];
  date: string;
  slot: Slot | null;
  notes: string;
};

export type BusyRange = { barberId: string; start: number; end: number };

export function ExtraEntry({
  index,
  value,
  barbers,
  busy,
  onChange,
  onRemove,
}: {
  index: number;
  value: ExtraBooking;
  barbers: Barber[];
  /** Horários já escolhidos nos outros blocos — não dá pra marcar por cima deles. */
  busy: BusyRange[];
  onChange: (next: ExtraBooking) => void;
  onRemove: () => void;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const barber = barbers.find((b) => b.id === value.barberId) ?? null;
  const services = useMemo(() => barber?.services.filter((s) => value.serviceIds.includes(s.id)) ?? [], [barber, value.serviceIds]);
  const duration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const price = services.reduce((sum, s) => sum + s.price, 0);

  async function load(barberId: string, date: string, minutes: number) {
    if (!barberId || minutes === 0) {
      setSlots([]);
      return;
    }
    setLoading(true);
    try {
      setSlots(await getAvailableSlotsForAdminAction(barberId, date, minutes));
    } finally {
      setLoading(false);
    }
  }

  const slotIsBusy = (slot: Slot) => {
    const start = Date.parse(slot.iso);
    const end = start + duration * 60_000;
    return busy.some((r) => r.barberId === value.barberId && start < r.end && r.start < end);
  };

  const htmlId = `extra-${value.key}`;

  return (
    <div className="space-y-4 rounded-xl border border-secondary/40 bg-[var(--surface-subtle)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Horário extra {index + 1}</p>
        <button type="button" onClick={onRemove} className="flex items-center gap-1 text-xs text-danger hover:underline" aria-label={`Remover horário extra ${index + 1}`}>
          <X className="h-3.5 w-3.5" /> Remover
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${htmlId}-barber`}>Barbeiro</Label>
        <Select
          id={`${htmlId}-barber`}
          value={value.barberId}
          onChange={(e) => {
            onChange({ ...value, barberId: e.target.value, serviceIds: [], slot: null });
            setSlots([]);
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

      {barber && (
        <div className="space-y-2">
          <Label>Serviços</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {barber.services.map((s) => {
              const checked = value.serviceIds.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    const next = checked ? value.serviceIds.filter((id) => id !== s.id) : [...value.serviceIds, s.id];
                    onChange({ ...value, serviceIds: next, slot: null });
                    const minutes = barber.services.filter((svc) => next.includes(svc.id)).reduce((sum, svc) => sum + svc.durationMinutes, 0);
                    void load(value.barberId, value.date, minutes);
                  }}
                  className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm transition-colors ${
                    checked ? "border-secondary bg-secondary/15" : "border bg-[var(--surface-subtle)]"
                  }`}
                >
                  <span>
                    {s.name} <span className="text-foreground-muted">({formatDuration(s.durationMinutes)})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {formatCurrency(s.price)}
                    {checked && <Check className="h-4 w-4 text-secondary-light" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.barberId && value.serviceIds.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor={`${htmlId}-date`}>Data</Label>
          <Input
            id={`${htmlId}-date`}
            type="date"
            value={value.date}
            min={shopNow().toISOString().slice(0, 10)}
            onChange={(e) => {
              onChange({ ...value, date: e.target.value, slot: null });
              void load(value.barberId, e.target.value, duration);
            }}
            className="max-w-xs"
          />
          {loading && <p className="text-sm text-foreground-muted">Carregando horários...</p>}
          {!loading && slots.length === 0 && <p className="text-sm text-foreground-muted">Nenhum horário disponível nesta data (clique em um serviço para carregar).</p>}
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => {
              const taken = slotIsBusy(slot);
              return (
                <button
                  key={slot.iso}
                  type="button"
                  disabled={taken}
                  title={taken ? "Já escolhido em outro horário desta marcação" : undefined}
                  onClick={() => onChange({ ...value, slot })}
                  className={`rounded-xl border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    value.slot?.iso === slot.iso
                      ? "border-secondary bg-secondary/20 text-foreground"
                      : "border bg-[var(--surface-subtle)] text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${htmlId}-notes`}>Observação deste horário</Label>
        <textarea
          id={`${htmlId}-notes`}
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={2}
          maxLength={500}
          placeholder="Ex.: corte do filho Pedro (opcional)"
          className="w-full rounded-xl border bg-[var(--surface-subtle)] p-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
        />
      </div>

      {services.length > 0 && (
        <p className="text-xs text-foreground-muted">
          {services.map((s) => s.name).join(", ")} · {formatDuration(duration)} · {formatCurrency(price)}
        </p>
      )}
    </div>
  );
}
