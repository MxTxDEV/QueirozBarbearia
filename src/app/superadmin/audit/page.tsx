import { listAuditLog } from "@/lib/data/superadmin";
import { formatDate, formatTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SuperAdminAuditPage() {
  const logs = await listAuditLog(150);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Auditoria</h1>
        <p className="text-sm text-foreground-muted">Últimos {logs.length} eventos registrados na plataforma.</p>
      </div>

      <Card variant="solid">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-foreground-muted">
                  {formatDate(log.createdAt)} {formatTime(log.createdAt)}
                </TableCell>
                <TableCell className="text-foreground-muted">{log.company?.name ?? "Plataforma"}</TableCell>
                <TableCell className="text-foreground-muted">{log.user?.name ?? "—"}</TableCell>
                <TableCell className="text-foreground">{log.action}</TableCell>
                <TableCell className="text-foreground-muted">
                  {log.entityType} · {log.entityId.slice(0, 10)}
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-foreground-muted">
                  Nenhum evento registrado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
