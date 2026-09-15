"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { adminCancelWaitlistEntryAction, adminConfirmWaitlistOfferAction } from "@/actions/waitlist";
import { Button } from "@/components/ui/button";
import type { WaitlistStatus } from "@prisma/client";

export function WaitlistRowActions({ entryId, status }: { entryId: string; status: WaitlistStatus }) {
  const [pending, startTransition] = useTransition();
  const isActive = status === "WAITING" || status === "OFFERED";

  function cancel() {
    if (!confirm("Cancelar esta entrada da lista de espera?")) return;
    startTransition(async () => {
      const result = await adminCancelWaitlistEntryAction(entryId);
      if (result.ok) toast.success("Entrada cancelada.");
      else toast.error(result.error);
    });
  }

  function confirmManually() {
    startTransition(async () => {
      const result = await adminConfirmWaitlistOfferAction(entryId);
      if (result.ok) toast.success("Agendamento confirmado.");
      else toast.error(result.error);
    });
  }

  if (!isActive) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      {status === "OFFERED" && (
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={confirmManually}>
          Confirmar
        </Button>
      )}
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancel}>
        Cancelar
      </Button>
    </div>
  );
}
