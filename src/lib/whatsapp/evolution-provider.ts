import type { WhatsAppProvider, WhatsappSendResult } from "./types";
import { describeFetchError } from "./evolution-client";

/**
 * Adapter para o Evolution API (self-hosted, baseado em Baileys). Requer
 * EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE configurados via
 * variáveis de ambiente. A conexão do número (leitura do QR code) é feita na
 * tela /admin/whatsapp — ver `evolution-client.ts`.
 */
export class EvolutionApiWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly instanceName: string
  ) {}

  async sendMessage(phone: string, message: string): Promise<WhatsappSendResult> {
    try {
      const res = await fetch(`${this.apiUrl}/message/sendText/${this.instanceName}`, {
        method: "POST",
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: phone.replace(/\D/g, ""),
          text: message,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { ok: false, errorMessage: `HTTP ${res.status}: ${body}` };
      }

      const json = (await res.json()) as { key?: { id?: string } };
      return { ok: true, providerMessageId: json.key?.id };
    } catch (error) {
      const message = describeFetchError(error);
      console.error("[WhatsApp/Evolution] Falha ao enviar mensagem:", message);
      return { ok: false, errorMessage: message };
    }
  }
}
