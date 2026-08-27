"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";

type Defaults = { fullName?: string; whatsapp?: string; email?: string; birthDate?: string; notes?: string };

export function CustomerForm({
  action,
  defaults,
}: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  defaults?: Defaults;
}) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nome completo *</Label>
          <Input id="fullName" name="fullName" defaultValue={defaults?.fullName} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp *</Label>
          <Input id="whatsapp" name="whatsapp" placeholder="(31) 99999-9999" defaultValue={defaults?.whatsapp} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={defaults?.email} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults?.birthDate} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes} />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton pendingText="Salvando...">Salvar cliente</SubmitButton>
    </form>
  );
}
