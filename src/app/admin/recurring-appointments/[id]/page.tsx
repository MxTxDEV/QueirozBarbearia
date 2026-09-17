import { notFound } from "next/navigation";
import { requireAdminContext } from "@/lib/require-admin";
import { getRecurringAppointmentDetail } from "@/lib/data/recurring";
import { previewSeriesOccurrences } from "@/lib/recurring-engine";
import { describeFrequency } from "@/lib/recurring-helpers";
import { formatDate, formatTime } from "@/lib/utils";
import { RECURRING_STATUS_LABEL, RECURRING_STATUS_VARIANT, RECURRING_OCCURRENCE_STATUS_LABEL, RECURRING_OCCURRENCE_STATUS_VARIANT } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ApprovalPanel } from "./approval-panel";
import { AdminSeriesActions } from "./series-actions";
import { OccurrenceRowActions } from "./occurrence-row-actions";
import { EditFuturePanel } from "./edit-future-panel";

export default async function RecurringAppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminContext();
  const { id } = await params;
  const series = await getRecurringAppointmentDetail(id, user.companyId);
  if (!series) notFound();

  const isPendingApproval = series.status === "PENDING_APPROVAL";
  const previews = isPendingApproval ? await previewSeriesOccurrences(series.id, user.companyId) : [];

  const editableOptions = series.occurrences
    .filter((o) => o.status === "PENDING" || o.status === "CONFIRMED" || o.status === "CONFLICT" || o.status === "WAITING_LIST")
    .map((o) => ({ occurrenceId: o.id, label: `${formatDate(o.scheduledDate)} ${formatTime(o.scheduledStartTime)}` }));

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Recorrências", href: "/admin/recurring-appointments" }, { label: series.customer.fullName }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{series.customer.fullName}</h1>
          <p className="text-sm text-foreground-muted">
            {series.service.name} com {series.barber.name} — {describeFrequency(series.frequencyUnit, series.intervalValue)} às{" "}
            {series.startTime}
          </p>
        </div>
        <Badge variant={RECURRING_STATUS_VARIANT[series.status]}>{RECURRING_STATUS_LABEL[series.status]}</Badge>
      </div>

      <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs text-foreground-muted">Início</p>
            <p className="font-medium text-foreground">{formatDate(series.startDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs text-foreground-muted">Término</p>
            <p className="font-medium text-foreground">
              {series.occurrencesLimit ? `${series.occurrencesLimit} ocorrências` : series.endDate ? formatDate(series.endDate) : "Sem data final"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs text-foreground-muted">Solicitado por</p>
            <p className="font-medium text-foreground">{series.createdByUser ? series.createdByUser.name : "Cliente"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-xs text-foreground-muted">Aprovado por</p>
            <p className="font-medium text-foreground">{series.approvedByUser ? series.approvedByUser.name : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {series.rejectionReason && (
        <Card>
          <CardContent className="text-sm text-danger">Motivo da recusa: {series.rejectionReason}</CardContent>
        </Card>
      )}

      {isPendingApproval ? (
        <Card>
          <CardHeader>
            <CardTitle>Analisar ocorrências</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalPanel
              seriesId={series.id}
              rows={previews.map((p) => ({
                occurrenceId: p.occurrence.id,
                dateLabel: formatDate(p.occurrence.scheduledDate),
                timeLabel: formatTime(p.occurrence.scheduledStartTime),
                status: p.previewStatus,
              }))}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AdminSeriesActions id={series.id} status={series.status} />
            <EditFuturePanel seriesId={series.id} options={editableOptions} />
          </div>

          <Card variant="solid">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.occurrences.map((occ) => (
                  <TableRow key={occ.id}>
                    <TableCell className="text-foreground-muted">{occ.occurrenceNumber}</TableCell>
                    <TableCell className="text-foreground-muted">{formatDate(occ.scheduledDate)}</TableCell>
                    <TableCell className="text-foreground-muted">{formatTime(occ.scheduledStartTime)}</TableCell>
                    <TableCell>
                      <Badge variant={RECURRING_OCCURRENCE_STATUS_VARIANT[occ.status]}>{RECURRING_OCCURRENCE_STATUS_LABEL[occ.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-foreground-muted">{occ.conflictReason ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <OccurrenceRowActions
                        occurrenceId={occ.id}
                        status={occ.status}
                        scheduledDate={occ.scheduledDate}
                        scheduledStartTime={occ.scheduledStartTime}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
