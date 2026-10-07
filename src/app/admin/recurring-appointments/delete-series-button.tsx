"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminDeleteRecurringAppointmentAction } from "@/actions/recurring-appointments";

export function DeleteSeriesButton({ id, customerName }: { id: string; customerName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    if (
      !confirm(
        `Excluir a recorrência cancelada de "${customerName}"? Ela some da lista. Agendamentos que já estão na agenda não são alterados. Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await adminDeleteRecurringAppointmentAction(id);
      if (result.ok) {
        toast.success("Recorrência excluída.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={`Excluir recorrência de ${customerName}`}
      title="Excluir recorrência"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
