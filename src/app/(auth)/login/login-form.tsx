"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/actions/auth";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm() {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" placeholder="voce@barberpro.com" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton className="w-full" pendingText="Entrando...">
        Entrar
      </SubmitButton>
      <p className="text-center text-sm text-foreground-muted">
        É cliente da barbearia?{" "}
        <Link href="/portal" className="font-medium text-secondary-light hover:underline">
          Acesse o portal do cliente
        </Link>
      </p>
    </form>
  );
}
