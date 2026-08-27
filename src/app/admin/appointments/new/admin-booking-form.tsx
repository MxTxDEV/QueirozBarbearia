"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { getAvailableSlotsAction } from "@/actions/availability";
import { createAppointmentAsAdmin } from "@/actions/appointments";

type Service = { id: string; name: string; price: number; durationMinutes: number };
type Barber = { id: string; name: string; services: Service[] };
type Customer = { id: string; fullName: string; whatsapp: string };
type Slot = { iso: string; label: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminBookingForm({ barbers, customers }: { barbers: Barber[]; customers: Customer[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const selectedServices = useMemo(
    () => barber?.services.filter((s) => serviceIds.includes(s.id)) ?? [],
    [barber, serviceIds]
  );
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  async function refreshSlots(nextBarberId: string, nextDate: string, duration: number) {
    if (!nextBarberId || duration === 0) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const result = await getAvailableSlotsAction(nextBarberId, nextDate, duration);
      setSlots(result);
    } finally {
      setLoadingSlots(false);
    }
  }

  function submit() {
    if (!customerId || !barberId || !selectedSlot || serviceIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await createAppointmentAsAdmin({ customerId, barberId, serviceIds, startTimeIso: selectedSlot.iso });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/appointments");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
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
                  setServiceIds([]);
                  refreshSlots(e.target.value, date, 0);
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
            <div className="space-y-2">
              <Label>Serviços</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {barber.services.map((s) => {
                  const checked = serviceIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        const next = checked ? serviceIds.filter((id) => id !== s.id) : [...serviceIds, s.id];
                        setServiceIds(next);
                        const dur = barber.services
                          .filter((svc) => next.includes(svc.id))
                          .reduce((sum, svc) => sum + svc.durationMinutes, 0);
                        refreshSlots(barberId, date, dur);
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

          {barberId && serviceIds.length > 0 && (
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                min={todayIso()}
                onChange={(e) => {
                  setDate(e.target.value);
                  refreshSlots(barberId, e.target.value, totalDuration);
                }}
                className="max-w-xs"
              />
              {loadingSlots && <p className="text-sm text-foreground-muted">Carregando horários...</p>}
              {!loadingSlots && slots.length === 0 && (
                <p className="text-sm text-foreground-muted">Nenhum horário disponível nesta data.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.iso}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                      selectedSlot?.iso === slot.iso
                        ? "border-secondary bg-secondary/20 text-foreground"
                        : "border bg-[var(--surface-subtle)] text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={submit} disabled={pending || !selectedSlot || !customerId} className="w-full sm:w-auto">
            {pending ? "Criando..." : "Criar agendamento"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium text-foreground">Resumo</p>
          <p className="text-sm text-foreground-muted">Serviços: {selectedServices.map((s) => s.name).join(", ") || "—"}</p>
          <p className="text-sm text-foreground-muted">Duração total: {formatDuration(totalDuration)}</p>
          <p className="text-base font-semibold text-secondary-light">{formatCurrency(totalPrice)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
