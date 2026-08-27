import type { WhatsAppProvider, WhatsappSendResult } from "./types";

/**
 * Adapter para a Meta WhatsApp Cloud API. Requer WHATSAPP_API_URL,
 * WHATSAPP_API_KEY e WHATSAPP_PHONE_NUMBER_ID configurados via variáveis de
 * ambiente — nunca hardcoded. Outros provedores (Twilio, Evolution API — ver
 * `evolution-provider.ts`) devem implementar a mesma interface
 * `WhatsAppProvider` em um arquivo próprio.
 */
export class CloudApiWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly phoneNumberId: string
  ) {}

  async sendMessage(phone: string, message: string): Promise<WhatsappSendResult> {
    try {
      const res = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace("+", ""),
          type: "text",
          text: { body: message },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { ok: false, errorMessage: `HTTP ${res.status}: ${body}` };
      }

      const json = (await res.json()) as { messages?: { id: string }[] };
      return { ok: true, providerMessageId: json.messages?.[0]?.id };
    } catch (error) {
      return { ok: false, errorMessage: error instanceof Error ? error.message : "Erro desconhecido" };
    }
  }
}
