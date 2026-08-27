import { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: "Verifique os campos informados.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Erro inesperado." };
}

export function actionSuccess<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}
