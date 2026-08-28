"use client";

import { useTransition } from "react";
import { CheckCircle2, PauseCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateCompanyStatusAction } from "@/actions/superadmin";

type Status = "ACTIVE" | "SUSPENDED" | "BLOCKED";

export function CompanyStatusActions({ companyId, status }: { companyId: string; status: Status }) {
  const [pending, startTransition] = useTransition();

  function setStatus(next: Status) {
    if (next === status) return;
    startTransition(() => updateCompanyStatusAction(companyId, next));
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={status === "ACTIVE" ? "default" : "secondary"} disabled={pending} onClick={() => setStatus("ACTIVE")}>
        <CheckCircle2 className="h-4 w-4" /> Ativar
      </Button>
      <Button size="sm" variant={status === "SUSPENDED" ? "default" : "secondary"} disabled={pending} onClick={() => setStatus("SUSPENDED")}>
        <PauseCircle className="h-4 w-4" /> Suspender
      </Button>
      <Button size="sm" variant={status === "BLOCKED" ? "default" : "secondary"} disabled={pending} onClick={() => setStatus("BLOCKED")}>
        <Ban className="h-4 w-4" /> Bloquear
      </Button>
    </div>
  );
}
