"use client";

import { useActionState, useRef } from "react";
import { createBarberBlockAction } from "@/actions/barber-blocks";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

const REASON_SUGGESTIONS = ["Compromisso pessoal", "Reunião", "Almoço", "Manutenção", "Atendimento externo"];

export function BarberBlockForm({ barberId }: { barberId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(async (_prev, formData) => {
    const result = await createBarberBlockAction(barberId, _prev, formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Data</Label>
          <Input name="date" type="date" required />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Início</Label>
          <Input name="startTime" type="time" required />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Fim</Label>
          <Input name="endTime" type="time" required />
        </div>
      </div>
      <Input name="reason" placeholder="Motivo (opcional)" list="barber-block-reason-suggestions" />
      <datalist id="barber-block-reason-suggestions">
        {REASON_SUGGESTIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton size="sm" pendingText="Bloqueando...">
        Bloquear horário
      </SubmitButton>
    </form>
  );
}
