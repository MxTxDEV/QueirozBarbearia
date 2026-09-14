"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/app/admin/dashboard/components/reveal";

const FAQ_ITEMS = [
  {
    q: "O que é o iCortes?",
    a: "Um sistema completo de gestão para barbearias: agenda, clientes, barbeiros, financeiro, PDV e relatórios em um só lugar.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O iCortes funciona direto no navegador, em qualquer computador ou celular. Se preferir, dá pra adicionar um atalho na tela inicial do celular, mas isso é opcional.",
  },
  {
    q: "Posso cadastrar vários barbeiros?",
    a: "Sim. Você cadastra quantos barbeiros precisar, cada um com sua própria agenda, horários de trabalho e acompanhamento de desempenho.",
  },
  {
    q: "O sistema possui agendamento online?",
    a: "Sim. Sua barbearia ganha uma página própria onde os clientes escolhem serviço, barbeiro e horário e agendam sozinhos, sem precisar ligar ou mandar mensagem.",
  },
  {
    q: "Posso controlar o financeiro?",
    a: "Sim. Receitas, despesas, fluxo de caixa e metas ficam organizados automaticamente, sem depender de planilhas.",
  },
  {
    q: "Existe teste grátis?",
    a: "Sim. Fale com a gente pelo WhatsApp e comece a testar o iCortes na sua barbearia.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim, o sistema é 100% responsivo e foi pensado para o dia a dia — inclusive para o barbeiro consultar a agenda direto do celular durante o expediente.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 className="text-center text-3xl font-bold text-[var(--ic-white)] sm:text-4xl">Perguntas frequentes</h2>
        </Reveal>

        <div className="mt-12 divide-y divide-[var(--ic-border)] border-y border-[var(--ic-border)]">
          {FAQ_ITEMS.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-base font-medium text-[var(--ic-white)] sm:text-lg">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[var(--ic-muted)] transition-transform duration-300 ${open ? "rotate-180 text-[var(--ic-red)]" : ""}`}
                  />
                </button>
                <div
                  className={`grid overflow-hidden transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 pr-8 text-sm leading-relaxed text-[var(--ic-muted)] sm:text-base">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
