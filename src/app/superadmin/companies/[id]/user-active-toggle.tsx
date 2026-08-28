"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleUserActiveAction } from "@/actions/superadmin";

export function UserActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => toggleUserActiveAction(userId, !active))}
    >
      {active ? "Bloquear" : "Ativar"}
    </Button>
  );
}
