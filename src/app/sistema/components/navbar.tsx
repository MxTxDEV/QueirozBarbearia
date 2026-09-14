"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SALES_WHATSAPP_URL } from "../whatsapp";

const NAV_LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
  { href: "#depoimentos", label: "Depoimentos" },
  { href: "#faq", label: "FAQ" },
];

/** Navbar fixa: transparente no topo, ganha fundo escuro + blur + borda sutil ao rolar. */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-[var(--ic-border)] bg-[var(--ic-bg)]/85 backdrop-blur-md" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-10">
        <Link href="/sistema" className="shrink-0">
          <BrandLogo height={26} />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-[var(--ic-muted)] transition-colors hover:text-[var(--ic-white)]">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle className="text-[var(--ic-muted)] hover:bg-[var(--ic-overlay)] hover:text-[var(--ic-white)]" />
          <a
            href={SALES_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--ic-red)] px-5 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(225,29,36,0.4)] transition-all hover:bg-[var(--ic-red-light)] hover:shadow-[0_0_24px_rgba(225,29,36,0.45)]"
          >
            Teste grátis
          </a>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle className="text-[var(--ic-muted)] hover:bg-[var(--ic-overlay)] hover:text-[var(--ic-white)]" />
          <button
            type="button"
            className="p-2 text-[var(--ic-white)]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--ic-border)] bg-[var(--ic-bg)]/98 px-6 py-6 backdrop-blur-md lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-medium text-[var(--ic-white)] transition-colors hover:bg-[var(--ic-overlay)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href={SALES_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-[var(--ic-red)] text-base font-semibold text-white"
          >
            Teste grátis
          </a>
        </div>
      )}
    </header>
  );
}
