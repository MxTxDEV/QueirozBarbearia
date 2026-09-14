import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
});

// Fonte e identidade visual (preto+vermelho+branco, ver .ic-landing em
// globals.css) escopadas só nesta rota — o resto do produto usa Geist e o
// tema "Dark Luxury" azul do painel operacional.
export default function SistemaLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${montserrat.variable} ic-landing font-[family-name:var(--font-montserrat)]`}>{children}</div>;
}
