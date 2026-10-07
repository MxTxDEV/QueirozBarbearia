"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { saveMessageSettingsAction } from "@/actions/whatsapp-automations";
import { DEFAULT_FOOTER_TEXT, applyFooter, renderTemplate } from "@/lib/whatsapp/automation-defs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Link de divulgação da barbearia + o rodapé que vai no fim de TODA mensagem automática. */
export function MessageSettingsCard({
  initial,
  suggestedLink,
}: {
  initial: { bookingLink: string; footerEnabled: boolean; footerText: string };
  /** O link que o sistema usa sozinho enquanto o campo estiver vazio (ou null se não der pra montar). */
  suggestedLink: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState(initial.bookingLink);
  const [enabled, setEnabled] = useState(initial.footerEnabled);
  const [text, setText] = useState(initial.footerText);
  const [error, setError] = useState<string | null>(null);

  const dirty = link !== initial.bookingLink || enabled !== initial.footerEnabled || text !== initial.footerText;
  const effectiveLink = link.trim() || suggestedLink;
  const preview = effectiveLink
    ? applyFooter("Olá, João! 💈\n\n(…sua mensagem…)", { enabled, text, link: effectiveLink, templateUsesLink: false })
    : "Sem link de agendamento: informe o link acima para ele ir nas mensagens.";

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveMessageSettingsAction({ bookingLink: link, footerEnabled: enabled, footerText: text });
      if (result.ok) {
        toast.success("Link e rodapé salvos.");
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-secondary-light" />
        <h2 className="text-lg font-semibold text-foreground">Link de agendamento em todas as mensagens</h2>
      </div>
      <p className="text-sm text-foreground-muted">
        O link de divulgação da barbearia vai no <strong className="text-foreground">final de toda mensagem automática</strong> (lembretes, confirmação,
        cancelamento, resumo do mês…), para o cliente agendar de novo com um toque.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="wa-link">Link de divulgação</Label>
        <Input
          id="wa-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={suggestedLink ?? "https://seusite.com/agendar/sua-barbearia"}
          inputMode="url"
        />
        {!link.trim() && suggestedLink && <p className="text-xs text-foreground-muted">Em branco: o sistema usa {suggestedLink}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        Colocar o link no final de todas as mensagens
      </label>

      {enabled && (
        <div className="space-y-1.5">
          <Label htmlFor="wa-footer">Texto do rodapé</Label>
          <Input id="wa-footer" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
            <button type="button" onClick={() => setText((t) => `${t}{link_agendamento}`)} className="rounded-lg border bg-[var(--surface-subtle)] px-2 py-1 text-foreground">
              {"{link_agendamento}"}
            </button>
            <button type="button" onClick={() => setText(DEFAULT_FOOTER_TEXT)} className="underline hover:text-foreground">
              Restaurar texto padrão
            </button>
            <span>Se uma mensagem já usa {"{link_agendamento}"} no meio do texto, o rodapé não é repetido nela.</span>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Como fica no fim da mensagem</p>
        <div className="max-w-md rounded-2xl rounded-tl-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-relaxed text-[#111b21] shadow">
          <p className="whitespace-pre-wrap break-words">{renderTemplate(preview, {})}</p>
        </div>
      </div>

      {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
      <Button onClick={save} disabled={pending || !dirty}>
        {pending ? "Salvando..." : dirty ? "Salvar" : "Salvo"}
      </Button>
    </Card>
  );
}
