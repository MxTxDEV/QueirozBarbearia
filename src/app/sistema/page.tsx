import type { Metadata } from "next";
import { SistemaClient } from "./sistema-client";

const TITLE = "iCortes | Gestão inteligente para barbearias";
const DESCRIPTION =
  "Agendamentos, clientes, barbeiros, financeiro, PDV e relatórios em um só lugar. Organize sua barbearia com o iCortes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "pt_BR",
    images: [{ url: "/marketing/screenshot-dashboard.png", width: 2000, height: 1125, alt: "Dashboard do iCortes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/marketing/screenshot-dashboard.png"],
  },
  alternates: {
    canonical: "/sistema",
  },
};

export default function SistemaPage() {
  return <SistemaClient />;
}
