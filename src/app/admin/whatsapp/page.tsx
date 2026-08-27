import { prisma } from "@/lib/prisma";
import { whatsappConnectionStatus } from "@/lib/whatsapp";
import { formatDate, formatTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function WhatsappSettingsPage() {
  const status = whatsappConnectionStatus();
  const [messages, sentCount, failedCount, lastMessage] = await Promise.all([
    prisma.whatsappMessage.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { customer: true } }),
    prisma.whatsappMessage.count({ where: { status: "SENT" } }),
    prisma.whatsappMessage.count({ where: { status: "FAILED" } }),
    prisma.whatsappMessage.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">WhatsApp</h1>
        <p className="text-sm text-foreground-muted">Status da integração e histórico de mensagens enviadas.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Status da conexão</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={status.connected ? "success" : "warning"}>
              {status.connected ? "Conectado (API real)" : "Modo de desenvolvimento (mock)"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Último envio</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue className="text-base">
              {lastMessage ? `${formatDate(lastMessage.createdAt)} ${formatTime(lastMessage.createdAt)}` : "—"}
            </CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mensagens enviadas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue>{sentCount}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Falhas de envio</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue className={failedCount > 0 ? "text-danger" : undefined}>{failedCount}</CardValue>
          </CardContent>
        </Card>
      </div>

      {!status.connected && (
        <Card>
          <CardContent className="text-sm text-foreground-muted">
            Nenhum provedor real de WhatsApp está configurado. Defina{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1">WHATSAPP_PROVIDER=cloud_api</code>,{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1">WHATSAPP_API_URL</code>,{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1">WHATSAPP_API_KEY</code> e{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1">WHATSAPP_PHONE_NUMBER_ID</code> nas variáveis de ambiente para
            ativar o envio real. Enquanto isso, todas as mensagens são simuladas e registradas normalmente abaixo.
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs text-foreground-muted">
                  {formatDate(m.createdAt)} {formatTime(m.createdAt)}
                </TableCell>
                <TableCell className="text-foreground-muted">{m.customer?.fullName ?? m.phone}</TableCell>
                <TableCell className="max-w-xs truncate text-foreground-muted" title={m.message}>
                  {m.message}
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "SENT" || m.status === "DELIVERED" ? "success" : m.status === "FAILED" ? "danger" : "warning"}>
                    {m.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {messages.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-foreground-muted">
                  Nenhuma mensagem enviada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
