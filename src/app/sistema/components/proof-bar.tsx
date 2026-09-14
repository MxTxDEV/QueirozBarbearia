const ITEMS = ["Agenda organizada", "Clientes centralizados", "Financeiro sob controle", "Gestão de equipe"];

/** Faixa discreta de microprova, logo abaixo do hero. */
export function ProofBar() {
  return (
    <div className="border-y border-[var(--ic-border)] bg-white/[0.02] px-6 py-5 sm:px-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-sm font-medium text-[var(--ic-muted)] sm:justify-between sm:text-base">
        {ITEMS.map((item, i) => (
          <span key={item} className="flex items-center gap-3">
            {item}
            {i < ITEMS.length - 1 && <span className="hidden text-[var(--ic-red)] sm:inline">•</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
