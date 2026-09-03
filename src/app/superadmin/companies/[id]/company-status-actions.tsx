"use client";

import { useTransition } from "react";
import { CheckCircle2, PauseCircle, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateCompanyStatusAction } from "@/actions/superadmin";

type Status = "ACTIVE" | "SUSPENDED" | "BLOCKED";

const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: "Empresa ativada.",
  SUSPENDED: "Empresa suspensa.",
  BLOCKED: "Empresa bloqueada.",
};

export function CompanyStatusActions({ companyId, status }: { companyId: string; status: Status }) {
  const [pending, startTransition] = useTransition();

  function setStatus(next: Status) {
    if (next === status) return;
    startTransition(async () => {
      try {
        await updateCompanyStatusAction(companyId, next);
        toast.success(STATUS_LABEL[next]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
      }
    });
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
