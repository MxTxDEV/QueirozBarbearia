import type { WhatsAppProvider, WhatsappSendResult } from "./types";

/**
 * Provedor mock usado em desenvolvimento e quando nenhuma credencial real está
 * configurada. Apenas loga a mensagem no console; o registro em
 * `whatsapp_messages` é feito pela camada de serviço (`sendWhatsapp`), não aqui.
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(phone: string, message: string): Promise<WhatsappSendResult> {
    console.log(`[WhatsApp MOCK] -> ${phone}\n${message}\n`);
    return { ok: true, providerMessageId: `mock_${Date.now()}` };
  }
}
