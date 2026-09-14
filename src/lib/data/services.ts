import "server-only";
import { prisma } from "@/lib/prisma";

export async function listServices(companyId: string) {
  return prisma.service.findMany({ where: { companyId }, orderBy: { name: "asc" } });
}
