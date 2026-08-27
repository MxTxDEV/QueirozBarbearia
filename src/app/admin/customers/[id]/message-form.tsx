"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { sendCustomerMessageAction } from "@/actions/customers";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";

const TEMPLATES = [
  {
    label: "Lembrete de horário",
    text: "Olá! 💈 Passando para lembrar do seu horário agendado na barbearia. Nos vemos em breve!",
  },
  {
    label: "Promoção",
    text: "Olá! Temos uma condição especial para você essa semana na barbearia. Bora agendar seu horário?",
  },
  {
    label: "Aniversário",
    text: "Parabéns! 🎉 Toda a equipe da barbearia deseja um ótimo dia. Que tal comemorar com um corte novo?",
  },
];

export function MessageForm({ customerId, phone }: { customerId: string; phone: string }) {
  const action = sendCustomerMessageAction.bind(null, customerId);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  const [text, setText] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground-muted">Enviando para {phone}</p>
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <Button key={t.label} type="button" variant="outline" size="sm" onClick={() => setText(t.text)}>
            {t.label}
          </Button>
        ))}
      </div>
      <form action={formAction} className="space-y-3">
        <Textarea
          name="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite sua mensagem..."
          rows={4}
          required
        />
        {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
        {state && state.ok && <p className="text-sm text-success">Mensagem enviada!</p>}
        <SubmitButton pendingText="Enviando...">Enviar pelo WhatsApp</SubmitButton>
      </form>
    </div>
  );
}
