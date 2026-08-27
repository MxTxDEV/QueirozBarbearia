import "server-only";
import { prisma } from "@/lib/prisma";

export async function listServices() {
  return prisma.service.findMany({ orderBy: { name: "asc" } });
}

export async function listActiveServices() {
  return prisma.service.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}
