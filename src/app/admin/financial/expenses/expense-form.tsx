"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { createExpenseAction } from "@/actions/financial";
import { EXPENSE_CATEGORIES } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";

export function ExpenseForm() {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(createExpenseAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição *</Label>
        <Input id="description" name="description" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">Categoria *</Label>
        <Select id="category" name="category" required defaultValue={EXPENSE_CATEGORIES[0]}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Valor (R$) *</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dueDate">Vencimento *</Label>
        <Input id="dueDate" name="dueDate" type="date" required />
      </div>
      <div className="flex items-center gap-2">
        <input id="recurring" name="recurring" type="checkbox" className="h-4 w-4 rounded border-white/20" />
        <Label htmlFor="recurring">Despesa recorrente</Label>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="recurrenceType">Recorrência</Label>
        <Select id="recurrenceType" name="recurrenceType" defaultValue="MONTHLY">
          <option value="WEEKLY">Semanal</option>
          <option value="MONTHLY">Mensal</option>
          <option value="YEARLY">Anual</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observação</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Despesa adicionada!</p>}
      <SubmitButton pendingText="Salvando...">Adicionar despesa</SubmitButton>
    </form>
  );
}
