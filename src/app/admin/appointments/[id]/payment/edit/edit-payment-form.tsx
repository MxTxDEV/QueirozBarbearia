"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { ActionResult } from "@/lib/action-helpers";
import { updateAppointmentPaymentsAction } from "@/actions/financial";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";

type Row = { id: string; amount: string; paymentMethod: string; paidAt: string };

export function EditPaymentForm({
  appointmentId,
  payments,
}: {
  appointmentId: string;
  payments: { id: string; amount: number; paymentMethod: string; paidAt: string }[];
}) {
  const action = updateAppointmentPaymentsAction.bind(null, appointmentId);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  const [rows, setRows] = useState<Row[]>(payments.map((p) => ({ id: p.id, amount: String(p.amount), paymentMethod: p.paymentMethod, paidAt: p.paidAt })));

  const payload = JSON.stringify(rows.map((r) => ({ id: r.id, amount: Number(r.amount), paymentMethod: r.paymentMethod, paidAt: r.paidAt })));
  const update = (id: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="payments" value={payload} />
      {rows.map((row, index) => (
        <div key={row.id} className="space-y-3">
          {rows.length > 1 && <p className="text-sm font-medium text-foreground">Pagamento {index + 1}</p>}
          <div className="space-y-1.5">
            <Label htmlFor={`amount-${row.id}`}>Valor pago (R$) *</Label>
            <Input
              id={`amount-${row.id}`}
              type="number"
              step="0.01"
              min="0.01"
              value={row.amount}
              onChange={(e) => update(row.id, { amount: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`method-${row.id}`}>Método de pagamento *</Label>
            <Select id={`method-${row.id}`} value={row.paymentMethod} onChange={(e) => update(row.id, { paymentMethod: e.target.value })}>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`date-${row.id}`}>Data do pagamento *</Label>
            <Input id={`date-${row.id}`} type="date" value={row.paidAt} onChange={(e) => update(row.id, { paidAt: e.target.value })} required />
          </div>
        </div>
      ))}
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton pendingText="Salvando...">Salvar alterações</SubmitButton>
        <Link href="/admin/appointments">
          <Button type="button" variant="outline">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
