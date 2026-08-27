"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { createManualIncomeAction } from "@/actions/financial";
import { INCOME_CATEGORIES, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";

export function IncomeForm() {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(createManualIncomeAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição *</Label>
        <Input id="description" name="description" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">Categoria *</Label>
        <Select id="category" name="category" required defaultValue={INCOME_CATEGORIES[0]}>
          {INCOME_CATEGORIES.map((c) => (
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
        <Label htmlFor="transactionDate">Data *</Label>
        <Input id="transactionDate" name="transactionDate" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paymentMethod">Método de pagamento *</Label>
        <Select id="paymentMethod" name="paymentMethod" required defaultValue="PIX">
          {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observação</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Receita registrada!</p>}
      <SubmitButton pendingText="Salvando...">Registrar receita</SubmitButton>
    </form>
  );
}
