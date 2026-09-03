import Link from "next/link";
import { listTransactions, type PeriodFilter } from "@/lib/data/financial";
import { getFinancialReport } from "@/lib/data/reports";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt } from "lucide-react";
import { requireAdminOnly } from "@/lib/require-admin";

const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Tudo" },
];

export default async function FinancialOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAdminOnly();
  const { period: periodParam } = await searchParams;
  const period = (periodParam as PeriodFilter) ?? "month";

  const [report, transactions] = await Promise.all([
    getFinancialReport(user.companyId, period),
    listTransactions(user.companyId, period),
  ]);

  const incomeByCategory = report.byCategory
    .filter((c) => c.income > 0)
    .sort((a, b) => b.income - a.income)
    .slice(0, 5);
  const expenseByCategory = report.byCategory
    .filter((c) => c.expense > 0)
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 5);
  const maxIncome = Math.max(...incomeByCategory.map((c) => c.income), 1);
  const maxExpense = Math.max(...expenseByCategory.map((c) => c.expense), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Financeiro</h1>
          <p className="text-sm text-foreground-muted">Fluxo de caixa e transações.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/financial/income">
            <Button variant="secondary">Nova receita</Button>
          </Link>
          <Link href="/admin/financial/expenses">
            <Button variant="secondary">Nova despesa</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link key={p.value} href={`/admin/financial?period=${p.value}`}>
            <Button size="sm" variant={period === p.value ? "default" : "secondary"}>
              {p.label}
            </Button>
          </Link>
        ))}
      </div>

      <div className="glass rounded-3xl p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Saldo do período</p>
        <p className={`mt-1 text-4xl font-semibold tracking-tight ${report.profit >= 0 ? "text-accent-light" : "text-danger"}`}>
          {formatCurrency(report.profit)}
        </p>
        <div className="mt-5 flex flex-wrap gap-8 border-t pt-4">
          <div>
            <p className="text-xs text-foreground-muted">Entradas</p>
            <p className="text-lg font-semibold text-success">{formatCurrency(report.income)}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-muted">Saídas</p>
            <p className="text-lg font-semibold text-danger">{formatCurrency(report.expense)}</p>
          </div>
        </div>
      </div>

      {(incomeByCategory.length > 0 || expenseByCategory.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass rounded-3xl p-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Receitas por categoria</p>
            {incomeByCategory.length === 0 && (
              <p className="mt-4 text-sm text-foreground-muted">Sem receitas neste período.</p>
            )}
            <ul className="mt-4 space-y-3">
              {incomeByCategory.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-foreground">{c.category}</span>
                    <span className="shrink-0 font-medium text-foreground">{formatCurrency(c.income)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                    <div className="h-full rounded-full bg-success" style={{ width: `${(c.income / maxIncome) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass rounded-3xl p-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Despesas por categoria</p>
            {expenseByCategory.length === 0 && (
              <p className="mt-4 text-sm text-foreground-muted">Sem despesas neste período.</p>
            )}
            <ul className="mt-4 space-y-3">
              {expenseByCategory.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-foreground">{c.category}</span>
                    <span className="shrink-0 font-medium text-foreground">{formatCurrency(c.expense)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                    <div className="h-full rounded-full bg-danger" style={{ width: `${(c.expense / maxExpense) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Card variant="solid">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-foreground-muted">{formatDate(t.transactionDate)}</TableCell>
                <TableCell className="text-foreground">{t.description}</TableCell>
                <TableCell className="text-foreground-muted">{t.category}</TableCell>
                <TableCell>
                  <Badge variant={t.type === "INCOME" ? "success" : "danger"}>
                    {t.type === "INCOME" ? "Receita" : "Despesa"}
                  </Badge>
                </TableCell>
                <TableCell className={t.type === "INCOME" ? "text-success" : "text-danger"}>
                  {t.type === "INCOME" ? "+" : "-"}
                  {formatCurrency(t.amount.toString())}
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    icon={Receipt}
                    title="Nenhuma transação neste período"
                    description="Receitas e despesas pagas aparecem aqui automaticamente."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
