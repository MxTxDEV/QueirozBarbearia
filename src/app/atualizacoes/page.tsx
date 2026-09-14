import type { Metadata } from "next";
import { SimpleInfoPage } from "@/components/simple-info-page";

export const metadata: Metadata = { title: "Atualizações | iCortes" };

export default function AtualizacoesPage() {
  return (
    <SimpleInfoPage title="Atualizações">
      <p>Ainda não temos um changelog público — o iCortes está em desenvolvimento ativo e novidades chegam direto pra quem já usa o sistema.</p>
      <p>Quer saber o que está por vir? Fale com a gente.</p>
    </SimpleInfoPage>
  );
}
