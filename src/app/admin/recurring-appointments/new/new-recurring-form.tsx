"use client";

import { shopNow } from "@/lib/shop-time";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRecurringAppointmentAsAdminAction } from "@/actions/recurring-appointments";
import { RecurrenceFields, type RecurrenceValue } from "@/components/recurrence-fields";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Service = { id: string; name: string; durationMinutes: number; price: number };
type Barber = { id: string; name: string; services: Service[] };
type Customer = { id: string; fullName: string; whatsapp: string };

function todayIso() {
  return shopNow().toISOString().slice(0, 10);
}

export function NewRecurringForm({ barbers, customers }: { barbers: Barber[]; customers: Customer[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("18:00");
  const [recurrence, setRecurrence] = useState<RecurrenceValue | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const barber = barbers.find((b) => b.id === barberId) ?? null;

  function submit() {
    setError(null);
    if (!customerId || !barberId || !serviceId) {
      setError("Preencha cliente, barbeiro e serviço.");
      return;
    }
    if (!recurrence?.valid) {
      setError(recurrence?.checking ? "Aguarde a conferência da agenda." : "Confira as datas da recorrência: precisa haver ao menos uma data livre.");
      return;
    }
    startTransition(async () => {
      const result = await createRecurringAppointmentAsAdminAction({
        customerId,
        barberId,
        serviceId,
        startDate: recurrence.dates[0],
        startTime,
        frequencyUnit: recurrence.frequencyUnit,
        intervalValue: recurrence.intervalValue,
        dates: recurrence.dates,
        manualDates: recurrence.manualDates,
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

        <RecurrenceFields startDate={startDate} barberId={barberId} serviceId={serviceId} startTime={startTime} onChange={setRecurrence} />

        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={submit} disabled={pending || !recurrence?.valid}>
          {pending ? "Criando..." : "Criar recorrência"}
        </Button>
      </CardContent>
    </Card>
  );
}
