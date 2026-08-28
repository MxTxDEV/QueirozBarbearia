"use client";

import { useActionState } from "react";
import { createCompanyUserAction } from "@/actions/superadmin";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";

export function NewUserForm({ companyId }: { companyId: string }) {
  const action = createCompanyUserAction.bind(null, companyId);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" required minLength={6} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">Papel</Label>
        <Select id="role" name="role" defaultValue="ADMIN">
          <option value="ADMIN">Administrador</option>
          <option value="BARBER">Barbeiro</option>
        </Select>
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Usuário criado!</p>}
      <SubmitButton pendingText="Criando...">Criar usuário</SubmitButton>
    </form>
  );
}
