import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateProductAction } from "@/actions/products";
import { toNumber } from "@/lib/serialize";
import { Card, CardContent } from "@/components/ui/card";
import { ProductForm } from "../../product-form";
import { requireAdminContext } from "@/lib/require-admin";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminContext();
  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, companyId: user.companyId } });
  if (!product) notFound();

  const action = updateProductAction.bind(null, id);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Breadcrumb items={[{ label: "Produtos", href: "/admin/products" }, { label: product.name }, { label: "Editar" }]} />
      <h1 className="text-2xl font-semibold text-foreground">Editar produto</h1>
      <Card>
        <CardContent>
          <ProductForm action={action} defaults={{ name: product.name, price: toNumber(product.price) }} />
        </CardContent>
      </Card>
    </div>
  );
}
