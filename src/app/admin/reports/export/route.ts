import { NextRequest, NextResponse } from "next/server";
import { getCustomerReport, getFinancialReport, getOperationalReport } from "@/lib/data/reports";
import { getBarberComparison } from "@/lib/data/dashboard";
import type { PeriodFilter } from "@/lib/data/financial";
import { requireAdminOnly } from "@/lib/require-admin";
import { csvRow, CSV_BOM } from "@/lib/csv";

const PERIOD_LABEL: Record<PeriodFilter, string> = {
  today: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  year: "Este ano",
  all: "Tudo",
};

/** Exporta o mesmo conteúdo da tela de Relatórios em CSV (um arquivo, com seções). */
export async function GET(request: NextRequest) {
  const user = await requireAdminOnly();
  const period = (request.nextUrl.searchParams.get("period") as PeriodFilter | null) ?? "month";

  const [financial, operational, customers, barbers] = await Promise.all([
    getFinancialReport(user.companyId, period),
    getOperationalReport(user.companyId, period),
    getCustomerReport(user.companyId, period),
    getBarberComparison(user.companyId),
  ]);

  let csv = CSV_BOM;
  csv += csvRow([`Relatório — ${PERIOD_LABEL[period]}`]);
  csv += "\r\n";

  csv += csvRow(["FINANCEIRO"]);
  csv += csvRow(["Receita", financial.income.toFixed(2)]);
  csv += csvRow(["Despesa", financial.expense.toFixed(2)]);
  csv += csvRow(["Lucro", financial.profit.toFixed(2)]);
  csv += "\r\n";
  csv += csvRow(["Categoria", "Receita", "Despesa"]);
  for (const c of financial.byCategory) {
    csv += csvRow([c.category, c.income.toFixed(2), c.expense.toFixed(2)]);
  }
  csv += "\r\n";

  csv += csvRow(["OPERACIONAL"]);
  csv += csvRow(["Total", operational.total]);
  csv += csvRow(["Concluídos", operational.completed]);
  csv += csvRow(["Confirmados", operational.confirmed]);
  csv += csvRow(["Pendentes", operational.pending]);
  csv += csvRow(["Cancelados", operational.cancelled]);
  csv += csvRow(["Não compareceu", operational.noShow]);
  csv += csvRow(["Taxa de confirmação (%)", operational.confirmationRate.toFixed(1)]);
  csv += "\r\n";

  csv += csvRow(["CLIENTES"]);
  csv += csvRow(["Novos clientes", customers.newCustomers]);
  csv += csvRow(["Clientes recorrentes", customers.recurrentCount]);
  csv += csvRow(["Clientes inativos (60+ dias)", customers.inactiveCount]);
  csv += "\r\n";
  csv += csvRow(["Cliente", "WhatsApp", "Total gasto"]);
  for (const t of customers.topSpenders) {
    if (!t.customer) continue;
    csv += csvRow([t.customer.fullName, t.customer.whatsapp, t.total.toFixed(2)]);
  }
  csv += "\r\n";

  csv += csvRow(["BARBEIROS (mês atual)"]);
  csv += csvRow(["Barbeiro", "Atendimentos", "Receita", "Ticket médio", "Cancelamentos"]);
  for (const b of barbers) {
    csv += csvRow([b.name, b.completed, b.revenue.toFixed(2), b.avgTicket.toFixed(2), b.cancelled]);
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${period}.csv"`,
    },
  });
}
