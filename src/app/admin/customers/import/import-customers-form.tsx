"use client";

import { useActionState, useRef } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ActionResult } from "@/lib/action-helpers";
import { importCustomersAction, type CustomerImportSummary } from "@/actions/customer-import";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function ImportCustomersForm() {
  const [state, formAction] = useActionState<ActionResult<CustomerImportSummary> | undefined, FormData>(
    importCustomersAction,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardContent className="space-y-4">
        <form ref={formRef} action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="file">Arquivo</Label>
            <Input id="file" name="file" type="file" accept=".xlsx,.xls,.csv" required />
          </div>
          {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
          <SubmitButton pendingText="Importando...">Importar</SubmitButton>
        </form>

        {state && state.ok && state.data && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="h-4 w-4" /> {state.data.createdCount} cliente(s) importado(s)
              </span>
              {state.data.skippedDuplicateCount > 0 && (
                <span className="text-foreground-muted">{state.data.skippedDuplicateCount} já cadastrado(s) (ignorados)</span>
              )}
              {state.data.errors.length > 0 && (
                <span className="flex items-center gap-1.5 text-warning">
                  <AlertTriangle className="h-4 w-4" /> {state.data.errors.length} linha(s) com problema
                </span>
              )}
            </div>

            {state.data.errors.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--surface-subtle)] text-foreground-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Linha</th>
                      <th className="px-3 py-2 text-left">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.errors.map((e, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{e.rowNumber}</td>
                        <td className="px-3 py-1.5">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
