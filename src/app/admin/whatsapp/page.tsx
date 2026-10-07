import { prisma } from "@/lib/prisma";
import { whatsappConnectionStatus } from "@/lib/whatsapp";
import { formatDate, formatTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminContext } from "@/lib/require-admin";
import { WhatsappQrConnectPanel } from "./qr-connect-panel";
import { AutomationsEditor, type RuleDto } from "./automations-editor";
import { listAutomations } from "@/lib/whatsapp/automations";
import Link from "next/link";

/**
 * Sempre dinâmica: a página consulta o estado da conexão do WhatsApp em
 * tempo real. Sem isso, o Next tenta pré-renderizar a rota durante o build,
 * a chamada `no-store` dispara um DynamicServerError para forçar o bailout,
 * e esse erro de controle acaba capturado pelo try/catch do cliente HTTP —
 * poluindo o log do build com uma falha que não existe.
 */
export const dynamic = "force-dynamic";

export default async function WhatsappSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireAdminContext();
  const { tab } = await searchParams;
  // Só o administrador mexe nas mensagens automáticas (barbeiro vê conexão e histórico).
  const canEditMessages = user.role === "ADMIN";
  const showMessages = canEditMessages && tab === "mensagens";

  if (showMessages) {
    const rules = await listAutomations(user.companyId);
    const dtos: RuleDto[] = rules.map((r) => ({
      id: r.id,
      kind: r.kind as RuleDto["kind"],
      name: r.name,
      enabled: r.enabled,
      template: r.template,
      audience: r.audience as RuleDto["audience"],
      offsetMinutes: r.offsetMinutes,
      sendTime: r.sendTime,
      dayOfMonth: r.dayOfMonth,
      version: r.updatedAt.toISOString(),
    }));
    return (
      <div className="space-y-6">
        <PageHeader subtitle="Escolha o que é enviado, para quem, quando e com qual texto." />
        <Tabs active="mensagens" canEditMessages />
        <AutomationsEditor rules={dtos} companyName={user.companyName ?? ""} />
      </div>
    );
  }

  const status = await whatsappConnectionStatus(user.companyId);
  const [messages, sentCount, failedCount, lastMessage] = await Promise.all([
    prisma.whatsappMessage.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { customer: true },
    }),
    prisma.whatsappMessage.count({ where: { companyId: user.companyId, status: "SENT" } }),
    prisma.whatsappMessage.count({ where: { companyId: user.companyId, status: "FAILED" } }),
    prisma.whatsappMessage.findFirst({ where: { companyId: user.companyId }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Status da integração e histórico de mensagens enviadas." />
      <Tabs active="conexao" canEditMessages={canEditMessages} />

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

      <Card variant="solid">
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

function PageHeader({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">WhatsApp</h1>
      <p className="text-sm text-foreground-muted">{subtitle}</p>
    </div>
  );
}

function Tabs({ active, canEditMessages }: { active: "conexao" | "mensagens"; canEditMessages: boolean }) {
  if (!canEditMessages) return null;
  const tab = (id: "conexao" | "mensagens", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === id ? "page" : undefined}
      className={
        active === id
          ? "rounded-xl border border-secondary bg-secondary/20 px-4 py-2 text-sm font-medium text-foreground"
          : "rounded-xl border px-4 py-2 text-sm text-foreground-muted hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Seções do WhatsApp" className="flex flex-wrap gap-2">
      {tab("conexao", "/admin/whatsapp", "Conexão e histórico")}
      {tab("mensagens", "/admin/whatsapp?tab=mensagens", "Mensagens automáticas")}
    </nav>
  );
}
