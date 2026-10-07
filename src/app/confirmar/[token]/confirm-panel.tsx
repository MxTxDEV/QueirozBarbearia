"use client";

import { useState, useTransition } from "react";
import { CalendarX, CheckCircle2 } from "lucide-react";
import { confirmAppointmentByTokenAction, declineAppointmentByTokenAction } from "@/actions/client-confirmation";
import { Button } from "@/components/ui/button";

type Outcome = "confirmed" | "declined" | null;

/** Os dois botões da página de confirmação: "Confirmar meu horário" e "Não vou poder ir". */
export function ConfirmPanel({ token, alreadyConfirmed, bookHref }: { token: string; alreadyConfirmed: boolean; bookHref: string }) {
  const [outcome, setOutcome] = useState<Outcome>(alreadyConfirmed ? "confirmed" : null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmAppointmentByTokenAction(token);
      if (result.ok) setOutcome("confirmed");
      else setError(result.error);
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      const result = await declineAppointmentByTokenAction(token);
      if (result.ok) setOutcome("declined");
      else setError(result.error);
    });
  }

  if (outcome === "confirmed") {
    return (
      <div className="space-y-3 text-center" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <p className="text-lg font-semibold text-foreground">Horário confirmado!</p>
        <p className="text-sm text-foreground-muted">Obrigado por avisar. Te esperamos no horário marcado.</p>
        {!asking && (
          <button type="button" onClick={() => setAsking(true)} className="text-sm text-foreground-muted underline hover:text-foreground">
            Mudei de ideia — não vou poder ir
          </button>
        )}
        {asking && <DeclineQuestion pending={pending} onYes={decline} onNo={() => setAsking(false)} />}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  if (outcome === "declined") {
    return (
      <div className="space-y-3 text-center" role="status">
        <CalendarX className="mx-auto h-12 w-12 text-foreground-muted" />
        <p className="text-lg font-semibold text-foreground">Horário cancelado</p>
        <p className="text-sm text-foreground-muted">Tudo bem, obrigado por avisar. Quando quiser, é só marcar outro horário.</p>
        <a href={bookHref} className="inline-block text-sm text-secondary-light hover:underline">
          Agendar outro horário
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-center text-sm text-danger">{error}</p>}
      <Button size="lg" className="w-full" onClick={confirm} disabled={pending}>
        <CheckCircle2 className="h-5 w-5" /> {pending && !asking ? "Confirmando..." : "Confirmar meu horário"}
      </Button>
      {!asking ? (
        <Button variant="ghost" className="w-full" onClick={() => setAsking(true)} disabled={pending}>
          Não vou poder ir
        </Button>
      ) : (
        <DeclineQuestion pending={pending} onYes={decline} onNo={() => setAsking(false)} />
      )}
    </div>
  );
}

function DeclineQuestion({ pending, onYes, onNo }: { pending: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div className="space-y-2 rounded-xl border p-3 text-center">
      <p className="text-sm text-foreground">Cancelar este horário?</p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onNo} disabled={pending}>
          Voltar
        </Button>
        <Button variant="destructive" size="sm" onClick={onYes} disabled={pending}>
          {pending ? "Cancelando..." : "Sim, cancelar"}
        </Button>
      </div>
    </div>
  );
}
