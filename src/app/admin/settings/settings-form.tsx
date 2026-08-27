"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateSystemNameAction } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function SettingsForm({ systemName }: { systemName: string }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(updateSystemNameAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="systemName">Nome do sistema</Label>
        <Input id="systemName" name="systemName" defaultValue={systemName} required />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Salvo!</p>}
      <SubmitButton pendingText="Salvando...">Salvar</SubmitButton>
    </form>
  );
}
