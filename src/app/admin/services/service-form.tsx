"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";

type Defaults = { name?: string; description?: string; price?: number; durationMinutes?: number };

export function ServiceForm({
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
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" defaultValue={defaults?.description} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="price">Preço (R$) *</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={defaults?.price} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="durationMinutes">Duração (min) *</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            step="5"
            min="5"
            defaultValue={defaults?.durationMinutes}
            required
          />
        </div>
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton pendingText="Salvando...">Salvar serviço</SubmitButton>
    </form>
  );
}
