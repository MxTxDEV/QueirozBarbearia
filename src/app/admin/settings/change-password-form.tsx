"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { changePasswordAction } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(changePasswordAction, undefined);

  return (
    <form action={formAction} key={state && state.ok ? "reset" : "form"} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nova senha</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={6} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Senha alterada com sucesso!</p>}
      <SubmitButton pendingText="Salvando...">Alterar senha</SubmitButton>
    </form>
  );
}
