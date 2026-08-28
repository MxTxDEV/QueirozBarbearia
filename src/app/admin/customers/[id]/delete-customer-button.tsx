"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { deleteCustomerAction } from "@/actions/customers";
import { SubmitButton } from "@/components/ui/submit-button";

export function DeleteCustomerButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const action = deleteCustomerAction.bind(null, customerId);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Excluir o cliente "${customerName}"? Essa ação não pode ser desfeita.`)) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton pendingText="Excluindo..." variant="destructive" size="sm">
        Excluir cliente
      </SubmitButton>
    </form>
  );
}
