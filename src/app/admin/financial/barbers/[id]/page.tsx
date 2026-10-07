import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { requireAdminOnly } from "@/lib/require-admin";
import { getBarberFinancials } from "@/lib/data/barber-financial";
import type { PeriodFilter } from "@/lib/data/financial";
import { formatPercent } from "@/lib/barber-financial-helpers";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Tudo" },
];

const PERIOD_VALUES = new Set(PERIODS.map((p) => p.value));

export default async function BarberFinancialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAdminOnly();
  const { id } = await params;
  const { period: periodParam } = await searchParams;
  const period: PeriodFilter = periodParam && PERIOD_VALUES.has(periodParam as PeriodFilter) ? (periodParam as PeriodFilter) : "month";

  const data = await getBarberFinancials(user.companyId, id, period);
  if (!data) notFound();

  const maxBucket = Math.max(...data.series.map((s) => s.value), 1);
  const maxCategory = Math.max(...data.byCategory.map((c) => c.value), 1);
  const maxMethod = Math.max(...data.byMethod.map((m) => m.value), 1);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "Financeiro", href: `/admin/financial?period=${period}` },
            { label: `Faturamento de ${data.barber.name}` },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Faturamento de {data.barber.name}</h1>
            <p className="text-sm text-foreground-muted">
              Tudo que {data.barber.name} faturou: atendimentos e vendas no PDV.
              {!data.barber.active && " (barbeiro inativo)"}
            </p>
          </div>
          <Link href={`/admin/financial?period=${period}`}>
            <Button variant="secondary">Voltar ao financeiro geral</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link key={p.value} href={`/admin/financial/barbers/${id}?period=${p.value}`}>
            <Button size="sm" variant={period === p.value ? "default" : "secondary"}>
              {p.label}
            </Button>
          </Link>
        ))}
      </div>

      <div className="glass rounded-3xl p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Faturamento do período</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-accent-light">{formatCurrency(data.income)}</p>
        <div className="mt-5 flex flex-wrap gap-8 border-t pt-4">
          <div>
            <p className="text-xs text-foreground-muted">Atendimentos / vendas</p>
            <p className="text-lg font-semibold text-foreground">{data.count}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted">Ticket médio</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(data.averageTicket)}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted">Parte do faturamento da barbearia</p>
            <p className="text-lg font-semibold text-foreground">{formatPercent(data.shareOfTotal)}</p>
            <p className="text-xs text-foreground-muted">de {formatCurrency(data.companyTotal)}</p>
          </div>
        </div>
      </div>

      {data.series.length > 0 && (
        <div className="glass rounded-3xl p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">
            Faturamento por {data.unit === "month" ? "mês" : "dia"}
          </p>
          <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto" role="img" aria-label={`Faturamento por ${data.unit === "month" ? "mês" : "dia"}`}>
            {data.series.map((s) => (
              <div key={s.key} className="flex h-full min-w-[22px] flex-1 flex-col items-center justify-end gap-1" title={`${s.label}: ${formatCurrency(s.value)}`}>
                <div className="w-full rounded-t-md bg-success/80" style={{ height: `${Math.max(3, (s.value / maxBucket) * 100)}%` }} />
                <span className="text-[10px] tabular-nums text-foreground-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.count > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <BarList title="Por categoria" rows={data.byCategory.map((c) => ({ label: c.category, value: c.value }))} max={maxCategory} />
          <BarList
            title="Por forma de pagamento"
            rows={data.byMethod.map((m) => ({ label: PAYMENT_METHOD_LABEL[m.method] ?? m.method, value: m.value }))}
            max={maxMethod}
          />
        </div>
      )}

      <Card variant="solid">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-foreground-muted">{formatDate(t.transactionDate)}</TableCell>
                <TableCell className="text-foreground">{t.description}</TableCell>
                <TableCell className="text-foreground-muted">{t.category}</TableCell>
                <TableCell className="text-foreground-muted">{t.paymentMethod ? (PAYMENT_METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod) : "—"}</TableCell>
                <TableCell className="text-success">+{formatCurrency(t.amount.toString())}</TableCell>
              </TableRow>
            ))}
            {data.transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={Receipt}
                    title="Nenhum faturamento neste período"
                    description={`Os atendimentos pagos e as vendas no PDV de ${data.barber.name} aparecem aqui automaticamente.`}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {data.totalTransactions > data.transactions.length && (
          <p className="border-t p-3 text-center text-xs text-foreground-muted">
            Mostrando os {data.transactions.length} lançamentos mais recentes de {data.totalTransactions}. Os totais acima consideram todos.
          </p>
        )}
      </Card>
    </div>
  );
}

function BarList({ title, rows, max }: { title: string; rows: { label: string; value: number }[]; max: number }) {
  return (
    <div className="glass rounded-3xl p-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">{title}</p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{r.label}</span>
              <span className="shrink-0 font-medium text-foreground">{formatCurrency(r.value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
              <div className="h-full rounded-full bg-success" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
