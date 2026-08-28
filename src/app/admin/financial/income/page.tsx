import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IncomeForm } from "./income-form";
import { requireAdminContext } from "@/lib/require-admin";

export default async function IncomePage() {
  const user = await requireAdminContext();
  const incomes = await prisma.financialTransaction.findMany({
    where: { companyId: user.companyId, type: "INCOME" },
    orderBy: { transactionDate: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Receitas</h1>
        <p className="text-sm text-foreground-muted">
          Pagamentos de atendimentos concluídos são lançados automaticamente. Use o formulário abaixo para receitas
          manuais.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-foreground-muted">{formatDate(t.transactionDate)}</TableCell>
                  <TableCell className="text-foreground">{t.description}</TableCell>
                  <TableCell className="text-foreground-muted">{t.category}</TableCell>
                  <TableCell className="text-foreground-muted">
                    {t.paymentMethod ? PAYMENT_METHOD_LABEL[t.paymentMethod] : "—"}
                  </TableCell>
                  <TableCell className="text-success">{formatCurrency(t.amount.toString())}</TableCell>
                </TableRow>
              ))}
              {incomes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-foreground-muted">
                    Nenhuma receita registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nova receita manual</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
