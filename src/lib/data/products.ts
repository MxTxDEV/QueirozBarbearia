import "server-only";
import { prisma } from "@/lib/prisma";

export async function listProducts(companyId: string) {
  return prisma.product.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}
