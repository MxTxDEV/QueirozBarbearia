"use client";

import { useActionState, useState } from "react";
import { requestCustomerOtpAction, verifyCustomerOtpAction } from "@/actions/customer-auth";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function PortalLoginForm() {
  const [requestState, requestAction] = useActionState<
    ActionResult<{ customerId: string; whatsapp: string }> | undefined,
    FormData
  >(requestCustomerOtpAction, undefined);
  const [verifyState, verifyAction] = useActionState<ActionResult | undefined, FormData>(verifyCustomerOtpAction, undefined);
  const [step, setStep] = useState<"phone" | "code">("phone");

  const customerId = requestState?.ok ? requestState.data?.customerId : undefined;
  const whatsapp = requestState?.ok ? requestState.data?.whatsapp : undefined;

  if (step === "phone" || !customerId) {
    return (
      <form
        action={async (formData) => {
          await requestAction(formData);
          setStep("code");
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">Seu WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" placeholder="(31) 99999-9999" required autoFocus />
        </div>
        {requestState && !requestState.ok && <p className="text-sm text-danger">{requestState.error}</p>}
        <SubmitButton className="w-full" pendingText="Enviando código...">
          Receber código no WhatsApp
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-4">
      <input type="hidden" name="customerId" value={customerId} />
      <p className="text-sm text-foreground-muted">
        Enviamos um código de acesso para <span className="font-medium text-foreground">{whatsapp}</span>.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="code">Código de verificação</Label>
        <Input id="code" name="code" placeholder="123456" required autoFocus inputMode="numeric" />
      </div>
      {verifyState && !verifyState.ok && <p className="text-sm text-danger">{verifyState.error}</p>}
      <SubmitButton className="w-full" pendingText="Verificando...">
        Entrar
      </SubmitButton>
      <button
        type="button"
        className="w-full text-center text-sm text-foreground-muted hover:text-foreground"
        onClick={() => setStep("phone")}
      >
        Usar outro número
      </button>
    </form>
  );
}
