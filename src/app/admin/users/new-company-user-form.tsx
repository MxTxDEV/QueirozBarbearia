"use client";

import { useActionState, useState } from "react";
import { createCompanyUserAction } from "@/actions/company-users";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";

export function NewCompanyUserForm({ availableBarbers }: { availableBarbers: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(createCompanyUserAction, undefined);
  const [role, setRole] = useState<"ADMIN" | "BARBER">("BARBER");

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
          <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "BARBER")}>
            <option value="BARBER">Barbeiro</option>
            <option value="ADMIN">Administrador</option>
          </Select>
        </div>
      </div>

      {role === "BARBER" && (
        <div className="space-y-1.5">
          <Label htmlFor="barberId">Vincular a um barbeiro cadastrado (opcional)</Label>
          <Select id="barberId" name="barberId" defaultValue="">
            <option value="">Sem vínculo por enquanto</option>
            {availableBarbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-foreground-muted">
            Vincular permite que esse barbeiro veja a própria agenda ao entrar. Sem vínculo, o login é criado mas não
            aparece na agenda — dá pra vincular depois em Barbeiros.
          </p>
        </div>
      )}

      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Usuário criado!</p>}
      <SubmitButton pendingText="Criando...">Criar usuário</SubmitButton>
    </form>
  );
}
