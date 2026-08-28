import { listExpenses } from "@/lib/data/financial";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RECURRENCE_LABEL, TRANSACTION_STATUS_LABEL, TRANSACTION_STATUS_VARIANT } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarkPaidForm } from "./mark-paid-form";
import { ExpenseForm } from "./expense-form";
import { requireAdminOnly } from "@/lib/require-admin";

export default async function ExpensesPage() {
  const user = await requireAdminOnly();
  const expenses = await listExpenses(user.companyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Despesas</h1>
        <p className="text-sm text-foreground-muted">Contas a pagar, recorrências e histórico de despesas.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card variant="solid" className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-foreground-muted">{formatDate(e.dueDate)}</TableCell>
                  <TableCell className="text-foreground">
                    {e.description}
                    {e.recurring && (
                      <span className="ml-1.5 text-xs text-foreground-muted">({RECURRENCE_LABEL[e.recurrenceType]})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-foreground-muted">{e.category}</TableCell>
                  <TableCell className="text-danger">{formatCurrency(e.amount.toString())}</TableCell>
                  <TableCell>
                    <Badge variant={TRANSACTION_STATUS_VARIANT[e.status]}>{TRANSACTION_STATUS_LABEL[e.status]}</Badge>
                  </TableCell>
                  <TableCell>{e.status !== "PAID" && <MarkPaidForm expenseId={e.id} />}</TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-foreground-muted">
                    Nenhuma despesa cadastrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nova despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
