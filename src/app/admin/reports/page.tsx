import Link from "next/link";
import { getCustomerReport, getFinancialReport, getOperationalReport } from "@/lib/data/reports";
import { getBarberComparison } from "@/lib/data/dashboard";
import type { PeriodFilter } from "@/lib/data/financial";
import { formatCurrency, formatWhatsappDisplay } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "month", label: "Este mês" },
  { value: "year", label: "Este ano" },
  { value: "all", label: "Tudo" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = (periodParam as PeriodFilter) ?? "month";

  const [financial, operational, customers, barbers] = await Promise.all([
    getFinancialReport(period),
    getOperationalReport(period),
    getCustomerReport(period),
    getBarberComparison(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link key={p.value} href={`/admin/reports?period=${p.value}`}>
              <Button size="sm" variant={period === p.value ? "default" : "secondary"}>
                {p.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">Financeiro</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Receita</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-success">{formatCurrency(financial.income)}</CardValue>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Despesa</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className="text-danger">{formatCurrency(financial.expense)}</CardValue>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lucro</CardTitle>
            </CardHeader>
            <CardContent>
              <CardValue className={financial.profit >= 0 ? "text-accent" : "text-danger"}>
                {formatCurrency(financial.profit)}
              </CardValue>
            </CardContent>
          </Card>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Receita</TableHead>
                <TableHead>Despesa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financial.byCategory.map((c) => (
                <TableRow key={c.category}>
                  <TableCell className="text-foreground">{c.category}</TableCell>
                  <TableCell className="text-success">{c.income > 0 ? formatCurrency(c.income) : "—"}</TableCell>
                  <TableCell className="text-danger">{c.expense > 0 ? formatCurrency(c.expense) : "—"}</TableCell>
                </TableRow>
              ))}
              {financial.byCategory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-foreground-muted">
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">Operacional</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat label="Total" value={operational.total} />
          <MiniStat label="Concluídos" value={operational.completed} />
          <MiniStat label="Confirmados" value={operational.confirmed} />
          <MiniStat label="Pendentes" value={operational.pending} />
          <MiniStat label="Cancelados" value={operational.cancelled} />
          <MiniStat label="Não compareceu" value={operational.noShow} />
        </div>
        <p className="text-sm text-foreground-muted">
          Taxa de confirmação: <span className="text-foreground">{operational.confirmationRate.toFixed(1)}%</span>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">Clientes</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniStat label="Novos clientes" value={customers.newCustomers} />
          <MiniStat label="Clientes recorrentes" value={customers.recurrentCount} />
          <MiniStat label="Clientes inativos (60+ dias)" value={customers.inactiveCount} />
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Total gasto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.topSpenders.map((t, i) =>
                t.customer ? (
                  <TableRow key={t.customer.id}>
                    <TableCell className="text-foreground">
                      #{i + 1} {t.customer.fullName}
                    </TableCell>
                    <TableCell className="text-foreground-muted">{formatWhatsappDisplay(t.customer.whatsapp)}</TableCell>
                    <TableCell className="text-secondary-dark">{formatCurrency(t.total)}</TableCell>
                  </TableRow>
                ) : null
              )}
              {customers.topSpenders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-foreground-muted">
                    Nenhum pagamento registrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">Barbeiros (mês atual)</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barbeiro</TableHead>
                <TableHead>Atendimentos</TableHead>
                <TableHead>Receita</TableHead>
                <TableHead>Ticket médio</TableHead>
                <TableHead>Cancelamentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {barbers.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-foreground">{b.name}</TableCell>
                  <TableCell className="text-foreground-muted">{b.completed}</TableCell>
                  <TableCell className="text-success">{formatCurrency(b.revenue)}</TableCell>
                  <TableCell className="text-foreground-muted">{formatCurrency(b.avgTicket)}</TableCell>
                  <TableCell className="text-foreground-muted">{b.cancelled}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-foreground-muted">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
