import type { Decimal } from "@prisma/client/runtime/library";

/** Converte campos Decimal do Prisma em number para passar de Server -> Client Components. */
export function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "object" ? Number(value.toString()) : Number(value);
}
