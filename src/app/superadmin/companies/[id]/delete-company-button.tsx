"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCompanyAction } from "@/actions/superadmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Exclui a empresa e tudo que pertence a ela (cascade no banco) —
 * irreversível. Confirmação por digitação do slug em vez de modal, seguindo
 * o padrão do resto do painel (ver SuperAdminRowActions para o mesmo estilo
 * de expand inline).
 */
export function DeleteCompanyButton({ companyId, companyName, slug }: { companyId: string; companyName: string; slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typedSlug, setTypedSlug] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (typedSlug !== slug) {
      toast.error("Identificador digitado não confere.");
      return;
    }
    startTransition(async () => {
      const result = await deleteCompanyAction(companyId, typedSlug);
      // deleteCompanyAction redirects on success — só chega aqui em erro.
      if (result && !result.ok) toast.error(result.error);
    });
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" /> Excluir empresa
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3">
      <p className="w-full text-sm text-foreground">
        Isso apaga <strong>{companyName}</strong> e todos os dados dela (usuários, clientes, agendamentos, financeiro,
        vendas) permanentemente. Digite <code className="rounded bg-[var(--surface-subtle-hover)] px-1 py-0.5">{slug}</code>{" "}
        para confirmar:
      </p>
      <Input
        value={typedSlug}
        onChange={(e) => setTypedSlug(e.target.value)}
        placeholder={slug}
        className="h-8 w-48"
        autoFocus
      />
      <Button size="sm" variant="destructive" disabled={pending || typedSlug !== slug} onClick={submit}>
        Confirmar exclusão
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setConfirming(false);
          setTypedSlug("");
        }}
      >
        Cancelar
      </Button>
    </div>
  );
}
