import { ClipboardList } from "lucide-react";
import { requireAdminContext } from "@/lib/require-admin";
import { listWaitlistEntries } from "@/lib/data/waitlist";
import { listBarbers } from "@/lib/data/barbers";
import { listServices } from "@/lib/data/services";
import type { AppointmentRangeFilter } from "@/lib/data/appointments";
import { formatDate, formatTime } from "@/lib/utils";
import { WAITLIST_STATUS_LABEL, WAITLIST_STATUS_VARIANT } from "@/lib/labels";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { WaitlistRowActions } from "./row-actions";
import type { WaitlistStatus } from "@prisma/client";

const RANGES: { value: AppointmentRangeFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "week", label: "Próximos dias" },
  { value: "all", label: "Todos" },
];

const STATUSES: WaitlistStatus[] = ["WAITING", "OFFERED", "CONFIRMED", "CANCELLED", "EXPIRED"];

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; barberId?: string; serviceId?: string; status?: string }>;
}) {
  const user = await requireAdminContext();
  const sp = await searchParams;
  const range = (sp.range as AppointmentRangeFilter) || "week";
  const barberId = sp.barberId || undefined;
  const serviceId = sp.serviceId || undefined;
  const status = (sp.status as WaitlistStatus) || undefined;

  const [entries, barbers, services] = await Promise.all([
    listWaitlistEntries(user.companyId, { range, barberId, serviceId, status }),
    listBarbers(user.companyId),
    listServices(user.companyId),
  ]);

  function buildHref(next: Partial<{ range: string; barberId: string; serviceId: string; status: string }>) {
    const params = new URLSearchParams({ range, ...(barberId && { barberId }), ...(serviceId && { serviceId }), ...(status && { status }) });
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `/admin/waitlist?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Lista de Espera</h1>
        <p className="text-sm text-foreground-muted">
          Clientes aguardando uma vaga compatível. Ofertas com HOLD ativo ficam reservadas só para aquele cliente até o prazo
          de confirmação vencer.
        </p>
      </div>

      {/* Filtros via navegação simples (sem JS necessário) — cada link já reflete a combinação atual dos outros filtros. */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-foreground-muted">Barbeiro:</span>
        <a href={buildHref({ barberId: "" })} className={!barberId ? "font-medium text-foreground" : "text-secondary-light hover:underline"}>
          Todos
        </a>
        {barbers.map((b) => (
          <a
            key={b.id}
            href={buildHref({ barberId: b.id })}
            className={barberId === b.id ? "font-medium text-foreground" : "text-secondary-light hover:underline"}
          >
            {b.name}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-foreground-muted">Serviço:</span>
        <a href={buildHref({ serviceId: "" })} className={!serviceId ? "font-medium text-foreground" : "text-secondary-light hover:underline"}>
          Todos
        </a>
        {services.map((s) => (
          <a
            key={s.id}
            href={buildHref({ serviceId: s.id })}
            className={serviceId === s.id ? "font-medium text-foreground" : "text-secondary-light hover:underline"}
          >
            {s.name}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-foreground-muted">Status:</span>
        <a href={buildHref({ status: "" })} className={!status ? "font-medium text-foreground" : "text-secondary-light hover:underline"}>
          Todos
        </a>
        {STATUSES.map((s) => (
          <a
            key={s}
            href={buildHref({ status: s })}
            className={status === s ? "font-medium text-foreground" : "text-secondary-light hover:underline"}
          >
            {WAITLIST_STATUS_LABEL[s]}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-foreground-muted">Período:</span>
        {RANGES.map((r) => (
          <a
            key={r.value}
            href={buildHref({ range: r.value })}
            className={range === r.value ? "font-medium text-foreground" : "text-secondary-light hover:underline"}
          >
            {r.label}
          </a>
        ))}
      </div>

      <Card variant="solid">
        {entries.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhuma entrada na lista de espera" description="Ninguém aguardando vaga com esses filtros." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Tolerância</TableHead>
                <TableHead>Barbeiro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium text-foreground">{entry.customer.fullName}</TableCell>
                  <TableCell className="text-foreground-muted">{entry.service.name}</TableCell>
                  <TableCell className="text-foreground-muted">{formatDate(entry.date)}</TableCell>
                  <TableCell className="text-foreground-muted">{formatTime(entry.preferredTime)}</TableCell>
                  <TableCell className="text-foreground-muted">±{entry.toleranceMinutes}min</TableCell>
                  <TableCell className="text-foreground-muted">
                    {entry.status === "OFFERED" && entry.offeredBarber
                      ? `${entry.offeredBarber.name} (oferecido)`
                      : entry.barber
                        ? entry.barber.name
                        : "Qualquer barbeiro"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={WAITLIST_STATUS_VARIANT[entry.status]}>{WAITLIST_STATUS_LABEL[entry.status]}</Badge>
                    {entry.status === "OFFERED" && entry.holdExpiresAt && (
                      <p className="mt-1 text-xs text-foreground-muted">até {formatTime(entry.holdExpiresAt)}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <WaitlistRowActions entryId={entry.id} status={entry.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
