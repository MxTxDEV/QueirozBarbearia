import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SALES_WHATSAPP_URL } from "../whatsapp";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Produto",
    links: [
      { label: "Recursos", href: "#recursos" },
      { label: "Planos", href: "#planos" },
      { label: "Atualizações", href: "/atualizacoes" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", href: "/sobre" },
      { label: "Contato", href: SALES_WHATSAPP_URL, external: true },
    ],
  },
  {
    title: "Suporte",
    links: [
      { label: "Central de ajuda", href: "#faq" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos de uso", href: "/termos" },
      { label: "Política de privacidade", href: "/privacidade" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--ic-border)] px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)] lg:gap-8">
          <div>
            <BrandLogo variant="light" height={26} />
            <p className="mt-4 max-w-xs text-sm text-[var(--ic-muted)]">Sistema de gestão para barbearias. Mais organização, mais controle, mais tempo para crescer.</p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ic-muted-dark)]">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--ic-muted)] transition-colors hover:text-[var(--ic-white)]">
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-[var(--ic-muted)] transition-colors hover:text-[var(--ic-white)]">
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-[var(--ic-border)] pt-8">
          <p className="text-xs text-[var(--ic-muted-dark)]">© 2026 iCortes. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
