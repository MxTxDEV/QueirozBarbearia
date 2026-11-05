"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { requestCustomerOtpAction, verifyCustomerOtpAction } from "@/actions/customer-auth";
import type { ActionResult } from "@/lib/action-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

const RESEND_SECONDS = 30;

export function PortalLoginForm({ companySlug }: { companySlug: string }) {
  const [requestState, requestAction] = useActionState<ActionResult<{ customerId: string; whatsapp: string }> | undefined, FormData>(
    requestCustomerOtpAction,
    undefined
  );
  const [verifyState, verifyAction] = useActionState<ActionResult | undefined, FormData>(verifyCustomerOtpAction, undefined);
  const [changingNumber, setChangingNumber] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [resending, startResend] = useTransition();

  const customerId = requestState?.ok ? requestState.data?.customerId : undefined;
  const whatsapp = requestState?.ok ? requestState.data?.whatsapp : undefined;
  const showCode = !!customerId && !changingNumber;

  // Contagem para liberar o "reenviar código".
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function resend() {
    if (!whatsapp) return;
    const formData = new FormData();
    formData.set("whatsapp", whatsapp);
    formData.set("companySlug", companySlug);
    setResendIn(RESEND_SECONDS);
    startResend(() => requestAction(formData));
  }

  if (!showCode) {
    return (
      <form
        action={(formData) => {
          setChangingNumber(false);
          setResendIn(RESEND_SECONDS);
          return requestAction(formData);
        }}
        className="space-y-4"
      >
        <input type="hidden" name="companySlug" value={companySlug} />
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">Seu WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" placeholder="(31) 99999-9999" inputMode="tel" autoComplete="tel" required autoFocus />
        </div>
        {requestState && !requestState.ok && <p className="text-sm text-danger">{requestState.error}</p>}
        <SubmitButton className="w-full" pendingText="Enviando código...">
          Receber código no WhatsApp
        </SubmitButton>
        <p className="text-center text-xs text-foreground-muted">Cadastro único: é só o seu WhatsApp, sem senha. Depois disso você entra direto.</p>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="space-y-4">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      <p className="text-sm text-foreground-muted">
        Enviamos um código de acesso para <span className="font-medium text-foreground">{whatsapp}</span>.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="code">Código de verificação</Label>
        <Input id="code" name="code" placeholder="123456" required autoFocus inputMode="numeric" autoComplete="one-time-code" />
      </div>
      {verifyState && !verifyState.ok && <p className="text-sm text-danger">{verifyState.error}</p>}
      {requestState && !requestState.ok && <p className="text-sm text-danger">{requestState.error}</p>}
      <SubmitButton className="w-full" pendingText="Verificando...">
        Entrar
      </SubmitButton>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="text-foreground-muted hover:text-foreground" onClick={() => setChangingNumber(true)}>
          Usar outro número
        </button>
        <button
          type="button"
          className="text-foreground-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          onClick={resend}
          disabled={resendIn > 0 || resending}
        >
          {resendIn > 0 ? `Reenviar código (${resendIn}s)` : "Reenviar código"}
        </button>
      </div>
    </form>
  );
}
