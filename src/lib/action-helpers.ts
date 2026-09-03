import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Erros lançados por chamadas Prisma que não foram previstas (violação de
 * constraint não tratada, erro de conexão etc.) carregam texto interno
 * (nomes de tabela/coluna/constraint) que não deve chegar ao cliente — ao
 * contrário de um `throw new Error("mensagem amigável")` escrito à mão em
 * uma action, que É a mensagem pensada pra aparecer na tela.
 */
function isUnexpectedPrismaError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientInitializationError
  );
}

export function actionError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: "Verifique os campos informados.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (isUnexpectedPrismaError(error)) {
    console.error("[actionError] erro inesperado do banco de dados:", error);
    return { ok: false, error: "Erro inesperado. Tente novamente em instantes." };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Erro inesperado." };
}

export function actionSuccess<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}
