"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

type Defaults = { name?: string; price?: number };

export function ProductForm({
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
        <Label htmlFor="price">Preço (R$) *</Label>
        <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={defaults?.price} required />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Produto salvo!</p>}
      <SubmitButton pendingText="Salvando...">Salvar produto</SubmitButton>
    </form>
  );
}
