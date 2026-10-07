"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmMyAppointmentAction } from "@/actions/client-confirmation";

/** "Confirmar presença": o cliente avisa a barbearia que vai ao horário (mesma confirmação do link do WhatsApp). */
export function ConfirmButton({ appointmentId }: { appointmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await confirmMyAppointmentAction(appointmentId);
            if (result.ok) {
              setError(null);
              toast.success("Horário confirmado! Te esperamos.");
              router.refresh();
            } else {
              setError(result.error);
              toast.error(result.error);
            }
          })
        }
      >
        <CheckCircle2 className="h-4 w-4" /> {pending ? "Confirmando..." : "Confirmar presença"}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
