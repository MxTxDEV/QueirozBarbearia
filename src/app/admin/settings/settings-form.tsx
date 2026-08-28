"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateBrandingAction } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function SettingsForm({ systemName, logoUrl }: { systemName: string; logoUrl: string }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(updateBrandingAction, undefined);
  const [preview, setPreview] = useState(logoUrl);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="systemName">Nome do sistema</Label>
        <Input id="systemName" name="systemName" defaultValue={systemName} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="logoUrl">URL da logo</Label>
        <Input
          id="logoUrl"
          name="logoUrl"
          type="url"
          placeholder="https://.../sua-logo.png"
          defaultValue={logoUrl}
          onChange={(e) => setPreview(e.target.value)}
        />
        <p className="text-xs text-foreground-muted">
          Link direto para uma imagem (PNG ou SVG com fundo transparente funciona melhor). Aparece no painel e no
          portal do cliente. Deixe em branco para usar o nome do sistema no lugar da logo.
        </p>
        {preview && (
          <div className="mt-2 flex h-16 items-center rounded-xl border bg-[var(--surface-subtle)] px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Pré-visualização da logo"
              className="max-h-10 w-auto object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
              onLoad={(e) => (e.currentTarget.style.display = "block")}
            />
          </div>
        )}
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Salvo!</p>}
      <SubmitButton pendingText="Salvando...">Salvar</SubmitButton>
    </form>
  );
}
