"use client";

import { useActionState, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, ExternalLink, Share2, QrCode as QrCodeIcon, Download } from "lucide-react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateCompanySlugAction, toggleOnlineBookingAction } from "@/actions/company-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

function subscribeNever() {
  return () => {};
}

/** Lê window.location.origin sem causar mismatch de hidratação: snapshot vazio no servidor, real assim que monta no cliente. */
function useOrigin() {
  return useSyncExternalStore(subscribeNever, () => window.location.origin, () => "");
}

export function BookingLinkSection({ slug: initialSlug, onlineBookingEnabled: initialEnabled }: { slug: string; onlineBookingEnabled: boolean }) {
  const [slug, setSlug] = useState(initialSlug);
  const [state, formAction] = useActionState<ActionResult<{ slug: string }> | undefined, FormData>(
    async (_prev, formData) => {
      const result = await updateCompanySlugAction(_prev, formData);
      if (result.ok && result.data) setSlug(result.data.slug);
      return result;
    },
    undefined
  );

  const [enabled, setEnabled] = useState(initialEnabled);
  const [togglePending, startToggle] = useTransition();

  const origin = useOrigin();
  const link = origin ? `${origin}/agendar/${slug}` : `/agendar/${slug}`;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(link, { width: 320, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [link, origin]);

  const whatsappShareUrl = useMemo(() => {
    const text = `Agende seu horário: ${link}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [link]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Agende seu horário", url: link });
      } catch {
        // usuário cancelou o compartilhamento — não é um erro
      }
    } else {
      await copyLink();
    }
  }

  function toggleBooking(next: boolean) {
    setEnabled(next);
    startToggle(async () => {
      const result = await toggleOnlineBookingAction(next);
      if (!result.ok) {
        setEnabled(!next);
        toast.error(result.error);
      } else {
        toast.success(next ? "Agendamento online ativado." : "Agendamento online desativado.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Agendamento online</p>
          <p className="text-xs text-foreground-muted">
            {enabled ? "Sua barbearia aparece em /agendar e aceita novos agendamentos." : "Sua barbearia está oculta e não aceita novos agendamentos online."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={togglePending}
          onClick={() => toggleBooking(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-secondary-dark" : "bg-[var(--surface-subtle)]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <form action={formAction} className="space-y-1.5">
        <Label htmlFor="slug">Identificador de URL (slug)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground-muted">/agendar/</span>
          <Input
            id="slug"
            name="slug"
            defaultValue={slug}
            onChange={(e) => (e.target.value = e.target.value.toLowerCase())}
            className="max-w-[220px]"
            required
          />
          <SubmitButton size="sm" variant="secondary" pendingText="Salvando...">
            Salvar
          </SubmitButton>
        </div>
        {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
        {state && state.ok && <p className="text-sm text-success">Link atualizado!</p>}
      </form>

      <div className="space-y-2">
        <Label>Seu link de agendamento</Label>
        <div className="flex items-center gap-2 rounded-xl border bg-[var(--surface-subtle)] px-3 py-2">
          <span className="flex-1 truncate text-sm text-foreground">{link}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
            <Copy className="h-4 w-4" /> Copiar link
          </Button>
          <a href={`/agendar/${slug}`} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="secondary" size="sm">
              <ExternalLink className="h-4 w-4" /> Abrir página
            </Button>
          </a>
          <Button type="button" variant="secondary" size="sm" onClick={shareLink}>
            <Share2 className="h-4 w-4" /> Compartilhar
          </Button>
          <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="secondary" size="sm">
              Compartilhar no WhatsApp
            </Button>
          </a>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <QrCodeIcon className="h-4 w-4" /> Divulgue sua barbearia
        </Label>
        <div className="flex flex-col items-center gap-3 rounded-xl border p-4 sm:flex-row sm:items-start">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR Code para ${link}`} className="h-40 w-40 rounded-lg bg-white p-2" />
          ) : (
            <div className="h-40 w-40 animate-pulse rounded-lg bg-[var(--surface-subtle)]" />
          )}
          <div className="space-y-2 text-center sm:text-left">
            <p className="text-sm text-foreground-muted">Escaneie para agendar seu horário.</p>
            {qrDataUrl && (
              <a href={qrDataUrl} download={`qrcode-${slug}.png`}>
                <Button type="button" variant="secondary" size="sm">
                  <Download className="h-4 w-4" /> Baixar QR Code
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
