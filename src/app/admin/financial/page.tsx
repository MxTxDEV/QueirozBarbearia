import Link from "next/link";
import { getCashFlow, listTransactions, type PeriodFilter } from "@/lib/data/financial";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const { period: periodParam } = await searchParams;
  const period = (periodParam as PeriodFilter) ?? "month";

  const [cashFlow, transactions] = await Promise.all([getCashFlow(period), listTransactions(period)]);

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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Entradas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue className="text-success">{formatCurrency(cashFlow.income)}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue className="text-danger">{formatCurrency(cashFlow.expense)}</CardValue>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <CardValue className={cashFlow.balance >= 0 ? "text-accent" : "text-danger"}>
              {formatCurrency(cashFlow.balance)}
            </CardValue>
          </CardContent>
        </Card>
      </div>

      <Card>
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
                <TableCell colSpan={5} className="text-center text-foreground-muted">
                  Nenhuma transação neste período.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
