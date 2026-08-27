"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

type Defaults = { name?: string; phone?: string; photoUrl?: string; specialties?: string };

export function BarberForm({
  action,
  defaults,
}: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  defaults?: Defaults;
}) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" defaultValue={defaults?.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" name="phone" defaultValue={defaults?.phone} placeholder="(31) 99999-9999" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="photoUrl">URL da foto</Label>
        <Input id="photoUrl" name="photoUrl" defaultValue={defaults?.photoUrl} placeholder="https://..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="specialties">Especialidades (separadas por vírgula)</Label>
        <Input id="specialties" name="specialties" defaultValue={defaults?.specialties} placeholder="Corte, Barba, Degradê" />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Barbeiro salvo!</p>}
      <SubmitButton pendingText="Salvando...">Salvar barbeiro</SubmitButton>
    </form>
  );
}
