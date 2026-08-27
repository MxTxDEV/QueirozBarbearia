"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getWhatsappQrCodeAction, getWhatsappConnectionStateAction, disconnectWhatsappAction } from "@/actions/whatsapp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const POLL_INTERVAL_MS = 3000;

export function WhatsappQrConnectPanel({
  connected: initialConnected,
  connectedNumber: initialConnectedNumber,
}: {
  connected: boolean;
  connectedNumber?: string;
}) {
  const [connected, setConnected] = useState(initialConnected);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(initialConnectedNumber ?? null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => stopPolling, []);

  function handleGenerateQr() {
    setError(null);
    startTransition(async () => {
      const result = await getWhatsappQrCodeAction();
      if (!result.ok || !result.data) {
        setError(!result.ok ? result.error : "QR code não retornado.");
        return;
      }
      setQrCode(result.data.base64);

      stopPolling();
      pollRef.current = setInterval(async () => {
        const state = await getWhatsappConnectionStateAction();
        if (state.ok && state.data?.connected) {
          setConnected(true);
          setConnectedNumber(state.data.phone ?? null);
          setQrCode(null);
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    });
  }

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectWhatsappAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConnected(false);
      setConnectedNumber(null);
      setQrCode(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexão do WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={connected ? "success" : "warning"}>{connected ? "Conectado" : "Desconectado"}</Badge>
          {connected && connectedNumber && <span className="text-sm text-foreground-muted">{connectedNumber}</span>}
        </div>

        {!connected && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-muted">
              Gere o QR code e escaneie no WhatsApp do número da barbearia, em Aparelhos conectados → Conectar um
              aparelho.
            </p>
            <Button type="button" onClick={handleGenerateQr} disabled={isPending}>
              {isPending && !qrCode ? "Gerando..." : "Gerar QR Code"}
            </Button>
            {qrCode && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem base64 dinâmica, não um asset estático
              <img src={qrCode} alt="QR Code para conectar o WhatsApp" className="h-64 w-64 rounded-lg border" />
            )}
          </div>
        )}

        {connected && (
          <Button type="button" variant="destructive" onClick={handleDisconnect} disabled={isPending}>
            {isPending ? "Desconectando..." : "Desconectar"}
          </Button>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
