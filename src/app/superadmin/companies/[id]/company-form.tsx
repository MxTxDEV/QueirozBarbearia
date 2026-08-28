"use client";

import { useActionState } from "react";
import { updateCompanyAction } from "@/actions/superadmin";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function CompanyForm({
  companyId,
  defaults,
}: {
  companyId: string;
  defaults: { name: string; whatsapp?: string; email?: string; phone?: string };
}) {
  const action = updateCompanyAction.bind(null, companyId);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={defaults.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="whatsapp">WhatsApp</Label>
        <Input id="whatsapp" name="whatsapp" defaultValue={defaults.whatsapp} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail de contato</Label>
        <Input id="email" name="email" type="email" defaultValue={defaults.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" name="phone" defaultValue={defaults.phone} />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Dados atualizados!</p>}
      <SubmitButton pendingText="Salvando...">Salvar alterações</SubmitButton>
    </form>
  );
}
