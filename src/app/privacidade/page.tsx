import type { Metadata } from "next";
import { SimpleInfoPage } from "@/components/simple-info-page";

export const metadata: Metadata = { title: "Política de privacidade | iCortes" };

export default function PrivacidadePage() {
  return (
    <SimpleInfoPage title="Política de privacidade">
      <p>Ainda estamos formalizando a política de privacidade completa do iCortes.</p>
      <p>Se você precisa desse documento agora, fale com a gente que enviamos diretamente.</p>
    </SimpleInfoPage>
  );
}
