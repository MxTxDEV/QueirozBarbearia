import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type Alert = { text: string; href: string };

export function AttentionSection({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="glass rounded-3xl p-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">O que precisa de atenção</p>
      {alerts.length === 0 ? (
        <p className="mt-8 text-center text-sm text-foreground-muted">Tudo em dia por aqui.</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {alerts.map((a) => (
            <Link
              key={a.text}
              href={a.href}
              className="flex items-center gap-2.5 rounded-2xl border border-warning/20 bg-warning/[0.06] px-4 py-3 text-sm text-foreground transition-colors hover:bg-warning/[0.1]"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              {a.text}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
