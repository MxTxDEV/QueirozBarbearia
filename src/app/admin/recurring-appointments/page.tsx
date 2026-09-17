import Link from "next/link";
import { Plus, Repeat } from "lucide-react";
import { requireAdminContext } from "@/lib/require-admin";
import { listRecurringAppointmentsForAdmin } from "@/lib/data/recurring";
import { formatDate, formatTime } from "@/lib/utils";
import { RECURRING_STATUS_LABEL, RECURRING_STATUS_VARIANT } from "@/lib/labels";
import { describeFrequency } from "@/lib/recurring-helpers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import type { RecurringAppointmentStatus } from "@prisma/client";

const STATUSES: { value: RecurringAppointmentStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "PENDING_APPROVAL", label: "Pendentes" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "PAUSED", label: "Pausadas" },
  { value: "REJECTED", label: "Recusadas" },
  { value: "CANCELLED", label: "Canceladas" },
];

export default async function AdminRecurringAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAdminContext();
  const sp = await searchParams;
  const status = sp.status && sp.status !== "all" ? (sp.status as RecurringAppointmentStatus) : undefined;

  const series = await listRecurringAppointmentsForAdmin(user.companyId, { status });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Recorrências</h1>
          <p className="text-sm text-foreground-muted">Solicitações e séries de agendamento recorrente dos clientes.</p>
        </div>
        <Link href="/admin/recurring-appointments/new">
          <Button>
            <Plus className="h-4 w-4" /> Nova recorrência
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={s.value === "all" ? "/admin/recurring-appointments" : `/admin/recurring-appointments?status=${s.value}`}
            className={
              (sp.status ?? "all") === s.value
                ? "rounded-xl border border-secondary bg-secondary/20 px-3 py-1.5 font-medium text-foreground"
                : "rounded-xl border px-3 py-1.5 text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
            }
          >
            {s.label}
          </Link>
        ))}
      </div>

      <Card variant="solid">
        {series.length === 0 ? (
          <EmptyState icon={Repeat} title="Nenhuma recorrência encontrada" description="Ninguém com recorrência nesse filtro ainda." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Próxima ocorrência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-foreground">{s.customer.fullName}</TableCell>
                  <TableCell className="text-foreground-muted">{s.service.name}</TableCell>
                  <TableCell className="text-foreground-muted">{describeFrequency(s.frequencyUnit, s.intervalValue)}</TableCell>
                  <TableCell className="text-foreground-muted">{s.startTime}</TableCell>
                  <TableCell className="text-foreground-muted">
                    {s.occurrences[0] ? `${formatDate(s.occurrences[0].scheduledDate)} ${formatTime(s.occurrences[0].scheduledStartTime)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={RECURRING_STATUS_VARIANT[s.status]}>{RECURRING_STATUS_LABEL[s.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/recurring-appointments/${s.id}`} className="text-sm text-secondary-light hover:underline">
                      {s.status === "PENDING_APPROVAL" ? "Analisar" : "Ver detalhes"}
                    </Link>
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
