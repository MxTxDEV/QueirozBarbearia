"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateBrandingAction, removeLogoAction } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function SettingsForm({
  systemName,
  currentLogoUrl,
  externalLogoUrl,
}: {
  systemName: string;
  currentLogoUrl: string | null;
  externalLogoUrl: string;
}) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(updateBrandingAction, undefined);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [removing, startRemoveTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="systemName">Nome do sistema</Label>
          <Input id="systemName" name="systemName" defaultValue={systemName} required />
        </div>

        <div className="space-y-2">
          <Label>Logo</Label>

          {preview && (
            <div className="flex h-16 items-center rounded-xl border bg-[var(--surface-subtle)] px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Pré-visualização da logo" className="max-h-10 w-auto object-contain" />
            </div>
          )}

          <Input id="logoFile" name="logoFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
          <p className="text-xs text-foreground-muted">PNG, JPG ou WEBP, até 2MB.</p>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="logoUrl">ou cole a URL de uma imagem</Label>
            <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://.../sua-logo.png" defaultValue={externalLogoUrl} />
          </div>

          {currentLogoUrl && (
            <button
              type="button"
              disabled={removing}
              onClick={() =>
                startRemoveTransition(async () => {
                  await removeLogoAction();
                  setPreview(null);
                })
              }
              className="text-xs text-danger hover:underline disabled:opacity-50"
            >
              {removing ? "Removendo..." : "Remover logo atual"}
            </button>
          )}
        </div>

        {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
        {state && state.ok && <p className="text-sm text-success">Salvo!</p>}
        <SubmitButton pendingText="Salvando...">Salvar</SubmitButton>
      </form>
    </div>
  );
}
