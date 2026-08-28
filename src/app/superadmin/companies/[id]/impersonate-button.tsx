"use client";

import { useTransition } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { impersonateUserAction } from "@/actions/superadmin";

export function ImpersonateButton({
  userId,
  active,
  label = "Entrar como",
  variant = "ghost",
}: {
  userId: string;
  active: boolean;
  label?: string;
  variant?: "ghost" | "secondary" | "default";
}) {
  const [pending, startTransition] = useTransition();
  if (!active) return null;

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() => startTransition(() => impersonateUserAction(userId))}
    >
      <LogIn className="h-3.5 w-3.5" /> {pending ? "Entrando..." : label}
    </Button>
  );
}
