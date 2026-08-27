"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { registerPaymentAction } from "@/actions/financial";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";

export function PaymentForm({ appointmentId, defaultAmount }: { appointmentId: string; defaultAmount: number }) {
  const action = registerPaymentAction.bind(null, appointmentId);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="amount">Valor recebido (R$) *</Label>
        <Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={defaultAmount} required />
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
        <Label htmlFor="paidAt">Data do pagamento *</Label>
        <Input id="paidAt" name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton pendingText="Registrando...">Confirmar pagamento</SubmitButton>
    </form>
  );
}
