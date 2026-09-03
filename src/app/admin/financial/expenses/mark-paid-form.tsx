"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { markExpensePaidAction } from "@/actions/financial";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";

export function MarkPaidForm({ expenseId }: { expenseId: string }) {
  const action = markExpensePaidAction.bind(null, expenseId);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Marcar como paga
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Input name="paidDate" type="date" required className="h-9 w-36" defaultValue={new Date().toISOString().slice(0, 10)} />
      <Select name="paymentMethod" required defaultValue="PIX" className="h-9 w-40" aria-label="Forma de pagamento">
        {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm">
        Confirmar
      </Button>
      {state && !state.ok && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}
