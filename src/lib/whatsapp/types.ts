export type WhatsappSendResult = {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
};

export interface WhatsAppProvider {
  /** Envia uma mensagem de texto livre para um número no formato +55DDNNNNNNNNN. */
  sendMessage(phone: string, message: string): Promise<WhatsappSendResult>;
}

export type AppointmentMessageData = {
  customerName: string;
  date: string;
  time: string;
  barberName: string;
  services: string[];
  totalPrice: string;
};
