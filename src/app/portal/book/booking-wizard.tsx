"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Scissors } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDuration, formatDate } from "@/lib/utils";
import { getAvailableSlotsAction } from "@/actions/availability";
import { createAppointmentAsCustomer } from "@/actions/appointments";

type Service = { id: string; name: string; price: number; durationMinutes: number };
type Barber = { id: string; name: string; photoUrl: string | null; specialties: string[]; services: Service[] };
type Slot = { iso: string; label: string };

const STEPS = ["Barbeiro", "Serviços", "Data e hora", "Resumo"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function BookingWizard({ barbers }: { barbers: Barber[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const selectedServices = useMemo(
    () => barber?.services.filter((s) => serviceIds.includes(s.id)) ?? [],
    [barber, serviceIds]
  );
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  async function loadSlots(nextDate: string) {
    if (!barberId || totalDuration === 0) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const result = await getAvailableSlotsAction(barberId, nextDate, totalDuration);
      setSlots(result);
    } finally {
      setLoadingSlots(false);
    }
  }

  function goToStep2() {
    setStep(1);
  }

  async function goToStep3() {
    setStep(2);
    await loadSlots(date);
  }

  function submit() {
    if (!barberId || !selectedSlot) return;
    setSubmitError(null);
    startTransition(async () => {
      const result = await createAppointmentAsCustomer({
        barberId,
        serviceIds,
        startTimeIso: selectedSlot.iso,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      router.push("/portal/appointments?success=1");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                i <= step ? "bg-secondary text-white" : "bg-white/10 text-foreground-muted"
              }`}
            >
              {i + 1}
            </span>
            <span className={i === step ? "text-foreground" : ""}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-white/15" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {barbers.map((b) => (
            <Card
              key={b.id}
              className={`cursor-pointer ${barberId === b.id ? "ring-2 ring-secondary" : ""}`}
              onClick={() => {
                setBarberId(b.id);
                setServiceIds([]);
              }}
            >
              <CardContent className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-secondary-light to-secondary-dark text-xl font-semibold text-white">
                  {b.name.slice(0, 1)}
                </div>
                <div>
                  <p className="font-medium text-foreground">{b.name}</p>
                  <p className="text-xs text-foreground-muted">{b.specialties.join(", ") || "Barbeiro"}</p>
                </div>
                {barberId === b.id && <Check className="ml-auto h-5 w-5 text-secondary-light" />}
              </CardContent>
            </Card>
          ))}
          <div className="sm:col-span-2">
            <Button disabled={!barberId} onClick={goToStep2} className="w-full sm:w-auto">
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 1 && barber && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {barber.services.map((s) => {
              const checked = serviceIds.includes(s.id);
              return (
                <Card
                  key={s.id}
                  className={`cursor-pointer ${checked ? "ring-2 ring-secondary" : ""}`}
                  onClick={() =>
                    setServiceIds((prev) => (checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]))
                  }
                >
                  <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Scissors className="h-4 w-4 text-secondary-light" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-foreground-muted">{formatDuration(s.durationMinutes)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">{formatCurrency(s.price)}</span>
                      {checked && <Check className="h-4 w-4 text-secondary-light" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {serviceIds.length > 0 && (
            <p className="text-sm text-foreground-muted">
              Total: <span className="font-medium text-foreground">{formatCurrency(totalPrice)}</span> ·{" "}
              {formatDuration(totalDuration)}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button disabled={serviceIds.length === 0} onClick={goToStep3}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="max-w-xs space-y-1.5">
            <label className="text-sm font-medium text-foreground-muted">Escolha a data</label>
            <Input
              type="date"
              value={date}
              min={todayIso()}
              onChange={(e) => {
                setDate(e.target.value);
                loadSlots(e.target.value);
              }}
            />
          </div>

          {loadingSlots && <p className="text-sm text-foreground-muted">Carregando horários...</p>}
          {!loadingSlots && slots.length === 0 && (
            <p className="text-sm text-foreground-muted">Nenhum horário disponível nesta data. Tente outro dia.</p>
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
                    : "border-white/10 bg-white/[0.03] text-foreground-muted hover:bg-white/[0.06]"
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button disabled={!selectedSlot} onClick={() => setStep(3)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 3 && barber && selectedSlot && (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Confirme seu agendamento</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Barbeiro</dt>
                <dd className="font-medium text-foreground">{barber.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Serviços</dt>
                <dd className="text-right font-medium text-foreground">
                  {selectedServices.map((s) => s.name).join(", ")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Data</dt>
                <dd className="font-medium text-foreground">{formatDate(date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Horário</dt>
                <dd className="font-medium text-foreground">{selectedSlot.label}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <dt className="text-foreground-muted">Valor total</dt>
                <dd className="text-base font-semibold text-secondary-light">{formatCurrency(totalPrice)}</dd>
              </div>
            </dl>
            {submitError && <p className="text-sm text-danger">{submitError}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={pending}>
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={submit} disabled={pending} className="flex-1">
                {pending ? "Enviando..." : "Solicitar agendamento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
