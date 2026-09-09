"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateCoverImageAction, removeCoverImageAction } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function CoverImageForm({ currentCoverUrl, externalCoverUrl }: { currentCoverUrl: string | null; externalCoverUrl: string }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(updateCoverImageAction, undefined);
  const [preview, setPreview] = useState<string | null>(currentCoverUrl);
  const [removing, startRemoveTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="space-y-3">
      <Label>Foto de capa</Label>
      <p className="text-xs text-foreground-muted">
        Aparece no topo do seu link de agendamento e nos cards da listagem pública em /agendar.
      </p>

      {preview && (
        <div className="h-28 w-full overflow-hidden rounded-xl border bg-[var(--surface-subtle)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Pré-visualização da capa" className="h-full w-full object-cover" />
        </div>
      )}

      <Input id="coverFile" name="coverFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
      <p className="text-xs text-foreground-muted">PNG, JPG ou WEBP, até 2MB.</p>

      <div className="space-y-1.5 pt-1">
        <Label htmlFor="coverUrl">ou cole a URL de uma imagem</Label>
        <Input id="coverUrl" name="coverUrl" type="url" placeholder="https://.../sua-capa.jpg" defaultValue={externalCoverUrl} />
      </div>

      {currentCoverUrl && (
        <button
          type="button"
          disabled={removing}
          onClick={() =>
            startRemoveTransition(async () => {
              await removeCoverImageAction();
              setPreview(null);
            })
          }
          className="text-xs text-danger hover:underline disabled:opacity-50"
        >
          {removing ? "Removendo..." : "Remover capa atual"}
        </button>
      )}

      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Salvo!</p>}
      <SubmitButton size="sm" pendingText="Salvando...">
        Salvar capa
      </SubmitButton>
    </form>
  );
}
