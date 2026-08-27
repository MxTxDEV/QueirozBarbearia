import { prisma } from "@/lib/prisma";
import { whatsappConnectionStatus } from "@/lib/whatsapp";
import { formatDate, formatTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WhatsappQrConnectPanel } from "./qr-connect-panel";

/**
 * Sempre dinâmica: a página consulta o estado da conexão do WhatsApp em
 * tempo real. Sem isso, o Next tenta pré-renderizar a rota durante o build,
 * a chamada `no-store` dispara um DynamicServerError para forçar o bailout,
 * e esse erro de controle acaba capturado pelo try/catch do cliente HTTP —
 * poluindo o log do build com uma falha que não existe.
 */
export const dynamic = "force-dynamic";

export default async function WhatsappSettingsPage() {
  const status = await whatsappConnectionStatus();
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
              {status.connected
                ? "Conectado (API real)"
                : status.configuredKind === "evolution"
                  ? "Aguardando conexão"
                  : "Modo de desenvolvimento (mock)"}
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

      {status.configuredKind === "evolution" && (
        <WhatsappQrConnectPanel connected={status.connected} connectedNumber={status.connectedNumber} />
      )}

      {status.configuredKind !== "evolution" && !status.connected && (
        <Card>
          <CardContent className="text-sm text-foreground-muted">
            Nenhum provedor real de WhatsApp está configurado. Defina{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1">WHATSAPP_PROVIDER=evolution</code> (ou{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1">cloud_api</code>) e as credenciais
            correspondentes nas variáveis de ambiente para ativar o envio real. Enquanto isso, todas as mensagens são
            simuladas e registradas normalmente abaixo.
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
