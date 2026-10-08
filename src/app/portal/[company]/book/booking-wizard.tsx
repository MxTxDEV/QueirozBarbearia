"use client";

import { shopNow } from "@/lib/shop-time";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, MessageCircle, Plus, Scissors, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDuration, formatDate } from "@/lib/utils";
import { getAvailableSlotsAction } from "@/actions/availability";
import { createAppointmentAsCustomer, createAppointmentsAsCustomer } from "@/actions/appointments";
import { WaitlistJoinForm } from "./waitlist-join-form";
import { RecurringRequestPanel } from "./recurring-request-panel";

type Service = { id: string; name: string; price: number; durationMinutes: number };
type Barber = { id: string; name: string; photoUrl: string | null; specialties: string[]; services: Service[] };
type Slot = { iso: string; label: string };

/** Horário já montado que espera o envio junto com o atual (ex: corte seu + corte do filho). */
type CartItem = {
  barberId: string;
  barberName: string;
  serviceIds: string[];
  serviceNames: string;
  date: string;
  slot: Slot;
  notes: string;
  price: number;
  durationMinutes: number;
};

const MAX_BOOKINGS = 5;

const STEPS = ["Barbeiro", "Serviços", "Data e hora", "Resumo"] as const;

function todayIso() {
  return shopNow().toISOString().slice(0, 10);
}

export function BookingWizard({ barbers, companySlug, whatsapp }: { barbers: Barber[]; companySlug: string; whatsapp: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
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

  // Horários já guardados no carrinho: o mesmo barbeiro não pode ser marcado em cima deles.
  const slotTakenByCart = (slot: Slot) => {
    const start = Date.parse(slot.iso);
    const end = start + totalDuration * 60_000;
    return cart.some((item) => {
      const itemStart = Date.parse(item.slot.iso);
      return item.barberId === barberId && start < itemStart + item.durationMinutes * 60_000 && itemStart < end;
    });
  };

  /** Guarda o horário atual e volta pro começo pra escolher mais um (outro barbeiro, outro serviço ou outro horário). */
  function addAnother() {
    if (!barber || !selectedSlot) return;
    setCart((prev) => [
      ...prev,
      {
        barberId: barber.id,
        barberName: barber.name,
        serviceIds,
        serviceNames: selectedServices.map((s) => s.name).join(", "),
        date,
        slot: selectedSlot,
        notes: notes.trim(),
        price: totalPrice,
        durationMinutes: totalDuration,
      },
    ]);
    setBarberId(null);
    setServiceIds([]);
    setSlots([]);
    setSelectedSlot(null);
    setNotes("");
    setRepeatEnabled(false);
    setStep(0);
  }

  function submit() {
    if (!barberId || !selectedSlot) return;
    setSubmitError(null);
    startTransition(async () => {
      const current = { barberId, serviceIds, startTimeIso: selectedSlot.iso, notes: notes.trim() || undefined };
      const result =
        cart.length > 0
          ? await createAppointmentsAsCustomer([
              ...cart.map((item) => ({ barberId: item.barberId, serviceIds: item.serviceIds, startTimeIso: item.slot.iso, notes: item.notes || undefined })),
              current,
            ])
          : await createAppointmentAsCustomer(current);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      router.push(`/portal/${companySlug}/appointments?success=1`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 text-xs text-foreground-muted sm:gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex min-w-0 items-center gap-1 sm:gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                i <= step ? "bg-secondary-dark text-white" : "bg-[var(--surface-subtle)] text-foreground-muted"
              }`}
            >
              {i + 1}
            </span>
            <span className={`hidden truncate sm:inline ${i === step ? "text-foreground" : ""}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px w-3 shrink-0 bg-[var(--border-glass)] sm:mx-1 sm:w-6" />}
          </div>
        ))}
      </div>

      {cart.length > 0 && step < 3 && (
        <p className="rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm text-foreground">
          Você já separou {cart.length} {cart.length === 1 ? "horário" : "horários"}. Escolha o próximo — eles serão enviados juntos no final.
        </p>
      )}

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {barbers.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBarberId(b.id);
                setServiceIds([]);
              }}
              className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className={`cursor-pointer ${barberId === b.id ? "ring-2 ring-secondary" : ""}`}>
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
            </button>
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
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setServiceIds((prev) => (checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]))
                  }
                  className="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Card className={`cursor-pointer ${checked ? "ring-2 ring-secondary" : ""}`}>
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
                </button>
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
          {!loadingSlots && slots.length === 0 && barberId && selectedServices[0] && (
            <div className="space-y-2">
              <p className="text-sm text-foreground-muted">Nenhum horário disponível nesta data. Tente outro dia.</p>
              {selectedServices.length > 1 && (
                <p className="text-xs text-foreground-muted">
                  A lista de espera funciona para um serviço por vez — sua entrada será para {selectedServices[0].name}.
                </p>
              )}
              <WaitlistJoinForm
                serviceId={selectedServices[0].id}
                serviceName={selectedServices.map((s) => s.name).join(", ")}
                barberId={barberId}
                barberName={barber?.name ?? ""}
                date={date}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button
                key={slot.iso}
                type="button"
                disabled={slotTakenByCart(slot)}
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-xl border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selectedSlot?.iso === slot.iso
                    ? "border-secondary bg-secondary/20 text-foreground"
                    : "border bg-[var(--surface-subtle)] text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
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
            <h2 className="text-lg font-semibold text-foreground">{cart.length > 0 ? `Confirme seus ${cart.length + 1} agendamentos` : "Confirme seu agendamento"}</h2>
            {cart.map((item, i) => (
              <div key={`${item.slot.iso}-${i}`} className="flex items-start justify-between gap-3 rounded-xl border bg-[var(--surface-subtle)] p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {formatDate(item.date)} às {item.slot.label} · {item.barberName}
                  </p>
                  <p className="text-foreground-muted">
                    {item.serviceNames} · {formatCurrency(item.price)}
                  </p>
                  {item.notes && <p className="italic text-foreground-muted">📝 {item.notes}</p>}
                </div>
                <button type="button" onClick={() => setCart((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 text-danger" aria-label="Remover este horário">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
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
              <div className="flex justify-between border-t pt-2">
                <dt className="text-foreground-muted">Valor total</dt>
                <dd className="text-base font-semibold text-secondary-light">{formatCurrency(totalPrice)}</dd>
              </div>
            </dl>
            <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p className="text-foreground">
                Enviaremos a confirmação no seu WhatsApp <strong>{whatsapp}</strong>: você recebe um link para <strong>confirmar o horário</strong> antes do
                atendimento. Não é o seu número? Saia e entre de novo com o número certo.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="portal-notes" className="text-sm font-medium text-foreground-muted">
                Observação (opcional)
              </label>
              <textarea
                id="portal-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Ex.: é o corte do meu filho Pedro"
                className="w-full rounded-xl border bg-[var(--surface-subtle)] p-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
              />
            </div>
            {cart.length + 1 < MAX_BOOKINGS && !repeatEnabled && (
              <button
                type="button"
                onClick={addAnother}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-secondary/60 px-3 py-2 text-sm text-secondary-light hover:bg-secondary/10"
              >
                <Plus className="h-4 w-4" /> Marcar mais um horário (outro serviço, outra pessoa ou outro dia)
              </button>
            )}
            {cart.length === 0 && (
            <label className="flex items-center gap-2 text-sm text-foreground-muted">
              <input
                type="checkbox"
                checked={repeatEnabled}
                onChange={(e) => setRepeatEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              Repetir este agendamento
            </label>
            )}

            {repeatEnabled && barberId && selectedServices[0] && (
              <RecurringRequestPanel
                barberId={barberId}
                serviceId={selectedServices[0].id}
                startDate={date}
                startTime={selectedSlot.label}
                onSuccess={() => router.push(`/portal/${companySlug}/recurring-appointments?requested=1`)}
              />
            )}

            {submitError && <p className="text-sm text-danger">{submitError}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={pending}>
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              {!repeatEnabled && (
                <Button onClick={submit} disabled={pending} className="flex-1">
                  {pending ? "Enviando..." : cart.length > 0 ? `Solicitar ${cart.length + 1} agendamentos` : "Solicitar agendamento"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
