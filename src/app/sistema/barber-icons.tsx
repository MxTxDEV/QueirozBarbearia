/**
 * Ícones decorativos de barbearia (pente, máquina, borrifador) sem
 * equivalente direto no lucide-react — desenhados no mesmo estilo de traço
 * fino usado no resto do ícone-set do app (stroke, sem preenchimento).
 * Puramente ilustrativos: usados como enfeite flutuante em /sistema, nunca
 * como ícone funcional/semântico.
 */

type IconProps = { className?: string };

export function CombIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="3.2" rx="1" />
      <path d="M5.2 7.2v12M8.4 7.2v12M11.6 7.2v8.6M14.8 7.2v12M18 7.2v8.6" />
    </svg>
  );
}

export function ClipperIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="7" y="2.5" width="10" height="6" rx="1" />
      <path d="M9.4 2.5v6M12 2.5v6M14.6 2.5v6" />
      <rect x="5.5" y="8.5" width="13" height="12.5" rx="2.5" />
      <path d="M9.5 13h5M9.5 16.2h5" />
    </svg>
  );
}

export function SprayBottleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6.5" y="9" width="9" height="12.5" rx="2.2" />
      <path d="M9.5 9V5.5a1 1 0 0 1 1-1h1" />
      <path d="M9.5 6.5h6.5l2.7-2" />
      <path d="M19.5 2.8l2 1.1-1.1 2M20.8 6.6l1.8 1.6" />
    </svg>
  );
}
