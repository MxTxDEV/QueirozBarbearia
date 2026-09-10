import Link from "next/link";
import { Package } from "lucide-react";
import { listProducts } from "@/lib/data/products";
import { createProductAction, toggleProductActiveAction } from "@/actions/products";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductForm } from "./product-form";
import { ToggleActiveButton } from "../services/toggle-active-button";
import { requireAdminContext } from "@/lib/require-admin";

export default async function ProductsPage() {
  const user = await requireAdminContext();
  const products = await listProducts(user.companyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Produtos</h1>
        <p className="text-sm text-foreground-muted">Catálogo de produtos vendáveis no PDV.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card variant="solid" className="lg:col-span-2">
          {products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto cadastrado"
              description="Use o formulário ao lado para cadastrar o primeiro produto do catálogo."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-foreground-muted">{formatCurrency(p.price.toString())}</TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "success" : "muted"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/products/${p.id}/edit`} className="text-sm text-secondary-light hover:underline">
                        Editar
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ToggleActiveButton id={p.id} active={p.active} action={toggleProductActiveAction} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Novo produto</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm action={createProductAction} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
