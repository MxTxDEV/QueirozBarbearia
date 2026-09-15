"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmWaitlistOfferAsCustomerAction, cancelWaitlistEntryAsCustomerAction } from "@/actions/waitlist";

export function WaitlistEntryActions({ entryId, canConfirm }: { entryId: string; canConfirm: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function confirmOffer() {
    setError(null);
    startTransition(async () => {
      const result = await confirmWaitlistOfferAsCustomerAction(entryId);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success("Agendamento confirmado!");
      router.refresh();
    });
  }

  function cancel() {
    if (!confirm("Sair da lista de espera?")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelWaitlistEntryAsCustomerAction(entryId);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Você saiu da lista de espera.");
      router.refresh();
    });
  }

  return (
    <div className="text-right">
      <div className="flex justify-end gap-2">
        {canConfirm && (
          <Button size="sm" disabled={pending} onClick={confirmOffer}>
            Confirmar horário
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={pending} onClick={cancel}>
          Sair da lista
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
