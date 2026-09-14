import type { Metadata } from "next";
import { SimpleInfoPage } from "@/components/simple-info-page";

export const metadata: Metadata = { title: "Termos de uso | iCortes" };

export default function TermosPage() {
  return (
    <SimpleInfoPage title="Termos de uso">
      <p>Ainda estamos formalizando os termos de uso completos do iCortes.</p>
      <p>Se você precisa desse documento agora — para fechar contrato com sua barbearia, por exemplo — fale com a gente que enviamos diretamente.</p>
    </SimpleInfoPage>
  );
}
