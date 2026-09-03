"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleUserActiveAction } from "@/actions/superadmin";

export function UserActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await toggleUserActiveAction(userId, !active);
            toast.success(active ? "Usuário bloqueado." : "Usuário ativado.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
          }
        })
      }
    >
      {active ? "Bloquear" : "Ativar"}
    </Button>
  );
}
