import { Navbar } from "./components/navbar";
import { Hero } from "./components/hero";
import { ProofBar } from "./components/proof-bar";
import { ProblemSection } from "./components/problem-section";
import { FeaturesSection } from "./components/features-section";
import { ShowcaseSection } from "./components/showcase-section";
import { ResultsStrip } from "./components/results-strip";
import { HowItWorks } from "./components/how-it-works";
import { TestimonialsSection } from "./components/testimonials-section";
import { PricingSection } from "./components/pricing-section";
import { FaqSection } from "./components/faq-section";
import { FinalCta } from "./components/final-cta";
import { Footer } from "./components/footer";

export function SistemaClient() {
  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <Hero />
      <ProofBar />
      <ProblemSection />
      <FeaturesSection />

      <ShowcaseSection
        eyebrow="Agenda"
        headline="Uma agenda que trabalha junto com você."
        text="Seus horários organizados, sua equipe sincronizada e seus clientes recebendo os lembretes certos."
        bullets={["Visão por dia, semana ou mês", "Conflitos de horário bloqueados automaticamente", "Status de cada atendimento em tempo real"]}
        imageSrc="/marketing/screenshot-agenda.png"
        imageAlt="Calendário mensal do iCortes com os agendamentos de todos os barbeiros"
        imageWidth={2000}
        imageHeight={1094}
      />

      <ShowcaseSection
        eyebrow="Financeiro"
        headline="Pare de administrar no escuro."
        text="Saiba quanto sua barbearia vende, quanto cada profissional produz e onde está o dinheiro do seu negócio."
        bullets={["Entradas e saídas separadas por categoria", "Ticket médio e faturamento sempre à vista", "Histórico completo de cada transação"]}
        imageSrc="/marketing/screenshot-financeiro.png"
        imageAlt="Tela financeira do iCortes mostrando saldo do período, receitas por categoria e transações"
        imageWidth={2000}
        imageHeight={1094}
        reverse
        tint
      />

      <ShowcaseSection
        eyebrow="Equipe"
        headline="Sua equipe também ganha clareza."
        text="Cada profissional sabe o que precisa fazer. Você sabe onde precisa agir."
        bullets={["Agenda e horário de trabalho individuais", "Desempenho e faturamento por barbeiro", "Metas acompanhadas em tempo real"]}
        imageSrc="/marketing/screenshot-dashboard.png"
        imageAlt="Dashboard do iCortes com faturamento e receita por serviço, usado para acompanhar o desempenho da equipe"
        imageWidth={2000}
        imageHeight={1125}
      />

      <ResultsStrip />
      <HowItWorks />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <Footer />
    </main>
  );
}
