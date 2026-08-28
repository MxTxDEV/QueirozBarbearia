"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza os dados da página em segundo plano em intervalos regulares,
 * sem exigir que o usuário recarregue a tela manualmente. Não renderiza
 * nada — só dispara `router.refresh()` periodicamente, que busca os dados
 * do Server Component de novo e reconcilia o DOM (não é um reload completo).
 */
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
