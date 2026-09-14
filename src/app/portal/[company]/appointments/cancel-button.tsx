"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelAppointmentAsCustomerAction } from "@/actions/appointments";

export function CancelButton({ appointmentId }: { appointmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="text-right">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!confirm("Cancelar esse agendamento? Essa ação não pode ser desfeita.")) return;
          startTransition(async () => {
            const result = await cancelAppointmentAsCustomerAction(appointmentId);
            if (!result.ok) {
              setError(result.error);
              toast.error(result.error);
            } else {
              setError(null);
              toast.success("Agendamento cancelado.");
              router.refresh();
            }
          });
        }}
      >
        Cancelar
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
