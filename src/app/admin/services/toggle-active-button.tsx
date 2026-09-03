"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToggleActiveButton({
  id,
  active,
  action,
}: {
  id: string;
  active: boolean;
  action: (id: string, active: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await action(id, !active);
            toast.success(active ? "Desativado com sucesso." : "Ativado com sucesso.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
          }
        })
      }
    >
      {active ? "Desativar" : "Ativar"}
    </Button>
  );
}
