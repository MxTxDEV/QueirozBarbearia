import { requireAdminContext } from "@/lib/require-admin";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ImportCustomersForm } from "./import-customers-form";

export default async function ImportCustomersPage() {
  await requireAdminContext();

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Clientes", href: "/admin/customers" }, { label: "Importar" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Importar clientes</h1>
        <p className="text-sm text-foreground-muted">
          Envie uma planilha (.xlsx, .xls ou .csv) com os clientes de um sistema anterior. A primeira linha deve ter os
          cabeçalhos das colunas — pelo menos nome e telefone.
        </p>
      </div>
      <ImportCustomersForm />
    </div>
  );
}
