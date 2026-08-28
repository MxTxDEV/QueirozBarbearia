"use client";

import { useActionState, useState } from "react";
import { createCompanyAction } from "@/actions/superadmin";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function NewCompanyForm() {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(createCompanyAction, undefined);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome da barbearia</Label>
        <Input
          id="name"
          name="name"
          required
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Identificador de URL (slug)</Label>
        <Input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
        />
        <p className="text-xs text-foreground-muted">Portal do cliente: /portal/{slug || "sua-barbearia"}/login</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="whatsapp">WhatsApp da barbearia (opcional)</Label>
        <Input id="whatsapp" name="whatsapp" placeholder="+55 31 99999-9999" />
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-sm font-medium text-foreground">Administrador inicial</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adminName">Nome</Label>
            <Input id="adminName" name="adminName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminEmail">E-mail</Label>
            <Input id="adminEmail" name="adminEmail" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminPassword">Senha</Label>
            <Input id="adminPassword" name="adminPassword" type="password" required minLength={6} />
          </div>
        </div>
      </div>

      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton className="w-full" pendingText="Criando...">
        Criar empresa
      </SubmitButton>
    </form>
  );
}
