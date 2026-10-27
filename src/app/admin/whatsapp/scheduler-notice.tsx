import { CheckCircle2, TriangleAlert } from "lucide-react";
import { getSchedulerLastRun } from "@/lib/scheduler-status";
import { describeAgo, schedulerHealth } from "@/lib/scheduler-health";

/**
 * Mostra se o envio automático (lembrete da manhã, 1 dia antes, resumo do mês…) está rodando. Esses
 * envios não acontecem na hora de uma ação do usuário — dependem do agendador —, então, sem este aviso,
 * "não chegou" fica sem explicação.
 */
export async function SchedulerNotice() {
  const health = schedulerHealth(await getSchedulerLastRun());

  if (health.state === "ok") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/30 bg-[var(--badge-success-bg)] p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Lembretes automáticos em dia</p>
          <p className="text-foreground-muted">
            Última verificação {describeAgo(health.minutesAgo ?? 0)}. O lembrete da manhã, o de “1 dia antes” e o resumo do mês saem sozinhos, no horário que você configurou.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-[var(--badge-warning-bg)] p-4 text-sm">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {health.state === "never" ? "Os lembretes automáticos ainda não rodaram" : `Os lembretes automáticos estão parados — última verificação ${describeAgo(health.minutesAgo ?? 0)}`}
        </p>
        <p className="text-foreground-muted">
          Enquanto isso, só saem as mensagens imediatas (agendamento, confirmação e cancelamento). O lembrete da manhã, o de “1 dia antes” e o resumo do mês não são enviados.
          {health.state === "never" && " Se o sistema acabou de ser atualizado, aguarde um minuto e recarregue esta página."}
        </p>
      </div>
    </div>
  );
}
