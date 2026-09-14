import type { Metadata } from "next";
import { SistemaClient } from "./sistema-client";

export const metadata: Metadata = {
  title: "iCortes | Sistema completo para barbearias",
  description:
    "Agenda online, PDV, financeiro e metas em um só sistema. Conheça o iCortes e profissionalize a gestão da sua barbearia.",
};

export default function SistemaPage() {
  return <SistemaClient />;
}
