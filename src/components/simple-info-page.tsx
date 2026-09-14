import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Layout simples reusado pelas páginas institucionais (/sobre,
 * /atualizacoes, /termos, /privacidade) linkadas no rodapé de /sistema —
 * conteúdo ainda não existe pra nenhuma delas, então em vez de um link
 * morto (404) ou "conteúdo" inventado, cada uma admite isso claramente e
 * oferece um jeito real de falar com a gente.
 */
export function SimpleInfoPage({ title, children }: { title: string; children: React.ReactNode }) {
  const whatsappUrl = "https://wa.me/5531997184670?text=" + encodeURIComponent("Olá! Vim pelo site do iCortes e queria falar com vocês.");

  return (
    <div className="ic-landing min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8 sm:px-10">
        <Link href="/sistema">
          <BrandLogo variant="light" height={24} />
        </Link>
        <Link href="/sistema" className="flex items-center gap-1.5 text-sm text-[var(--ic-muted)] hover:text-[var(--ic-white)]">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 sm:px-10">
        <h1 className="text-3xl font-bold text-[var(--ic-white)]">{title}</h1>
        <div className="mt-6 space-y-4 text-[var(--ic-muted)]">{children}</div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--ic-red)] px-6 text-sm font-semibold text-white transition-all hover:bg-[var(--ic-red-light)]"
        >
          <MessageCircle className="h-4 w-4" />
          Falar no WhatsApp
        </a>
      </main>
    </div>
  );
}
