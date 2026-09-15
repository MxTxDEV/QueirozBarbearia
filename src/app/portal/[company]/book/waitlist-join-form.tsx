"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { joinWaitlistAsCustomerAction } from "@/actions/waitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const TOLERANCE_OPTIONS = [30, 60, 90, 120];

export function WaitlistJoinForm({
  serviceId,
  serviceName,
  barberId,
  barberName,
  date,
}: {
  serviceId: string;
  serviceName: string;
  barberId: string;
  barberName: string;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [anyBarber, setAnyBarber] = useState(false);
  const [preferredTime, setPreferredTime] = useState("18:00");
  const [toleranceMinutes, setToleranceMinutes] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await joinWaitlistAsCustomerAction({
        serviceId,
        barberId: anyBarber ? null : barberId,
        date,
        preferredTime,
        toleranceMinutes,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setJoined(true);
      toast.success("Você entrou na lista de espera!");
    });
  }

  if (joined) {
    return (
      <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-4 text-sm text-foreground">
        Você está na lista de espera para <strong>{serviceName}</strong>. Avisaremos por WhatsApp assim que surgir uma vaga
        compatível — acompanhe em &quot;Meus agendamentos&quot;.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2 rounded-xl border p-4 text-center">
        <p className="text-sm font-medium text-foreground">Não encontrou um horário?</p>
        <p className="text-xs text-foreground-muted">Entre na lista de espera e avisaremos quando surgir uma vaga compatível.</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          Entrar na lista de espera
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="text-sm font-medium text-foreground">Sua preferência de horário</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-foreground-muted">Horário preferido</label>
          <Input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-foreground-muted">Tolerância</label>
          <Select value={toleranceMinutes} onChange={(e) => setToleranceMinutes(Number(e.target.value))}>
            {TOLERANCE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                ±{t} min
              </option>
            ))}
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground-muted">
        <input type="checkbox" checked={anyBarber} onChange={(e) => setAnyBarber(e.target.checked)} className="h-4 w-4" />
        Aceito qualquer barbeiro disponível (em vez de só {barberName})
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button size="sm" disabled={pending} onClick={submit}>
          {pending ? "Entrando..." : "Confirmar entrada na lista"}
        </Button>
      </div>
    </div>
  );
}
