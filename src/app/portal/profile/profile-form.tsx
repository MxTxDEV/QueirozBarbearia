"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateCustomerProfileAction } from "@/actions/portal-profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function ProfileForm({
  defaults,
}: {
  defaults: { fullName: string; email?: string; birthDate?: string };
}) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(updateCustomerProfileAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" defaultValue={defaults.fullName} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={defaults.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="birthDate">Data de nascimento</Label>
        <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults.birthDate} />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Perfil atualizado!</p>}
      <SubmitButton pendingText="Salvando...">Salvar alterações</SubmitButton>
    </form>
  );
}
