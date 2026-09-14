import type { Metadata } from "next";
import { SimpleInfoPage } from "@/components/simple-info-page";

export const metadata: Metadata = { title: "Sobre | iCortes" };

export default function SobrePage() {
  return (
    <SimpleInfoPage title="Sobre o iCortes">
      <p>O iCortes é um sistema de gestão feito para barbearias que querem sair do improviso: agendamentos, clientes, barbeiros, financeiro, PDV e relatórios em um só lugar.</p>
      <p>Estamos construindo a página institucional completa — enquanto isso, fale com a gente pra conhecer a história e o time por trás do sistema.</p>
    </SimpleInfoPage>
  );
}
