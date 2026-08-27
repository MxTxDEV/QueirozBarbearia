"use client";

import { useTransition } from "react";
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
      onClick={() => startTransition(() => action(id, !active))}
    >
      {active ? "Desativar" : "Ativar"}
    </Button>
  );
}
