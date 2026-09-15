"use client";

import { useActionState, useRef } from "react";
import { createSuperAdminAction } from "@/actions/superadmin";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function NewSuperAdminForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(async (_prev, formData) => {
    const result = await createSuperAdminAction(_prev, formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-3">
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
      <div className="sm:col-span-3">
        {state && !state.ok && <p className="mb-3 text-sm text-danger">{state.error}</p>}
        {state && state.ok && <p className="mb-3 text-sm text-success">Conta criada!</p>}
        <SubmitButton pendingText="Criando...">Criar Super Admin</SubmitButton>
      </div>
    </form>
  );
}
