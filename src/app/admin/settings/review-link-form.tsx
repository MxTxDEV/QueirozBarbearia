"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateReviewLinkAction } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function ReviewLinkForm({ currentReviewLinkUrl }: { currentReviewLinkUrl: string }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(updateReviewLinkAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="reviewLinkUrl">Link de avaliação (Google, etc.)</Label>
        <Input
          id="reviewLinkUrl"
          name="reviewLinkUrl"
          type="url"
          placeholder="https://g.page/r/.../review"
          defaultValue={currentReviewLinkUrl}
        />
        <p className="text-xs text-foreground-muted">
          Enviado automaticamente pro cliente por WhatsApp quando o barbeiro conclui o atendimento e confirma o
          pagamento. Deixe em branco para enviar só a mensagem de agradecimento, sem link.
        </p>
      </div>

      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Salvo!</p>}
      <SubmitButton pendingText="Salvando...">Salvar</SubmitButton>
    </form>
  );
}
