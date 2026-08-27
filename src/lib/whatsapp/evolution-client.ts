import "server-only";

export type EvolutionConfig = {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
};

/**
 * `fetch` do Node só relata "fetch failed" para qualquer falha de rede,
 * escondendo o motivo real (DNS, timeout, conexão recusada) em `error.cause`.
 * Isso desenrola essa causa para uma mensagem que dá pra diagnosticar.
 */
export function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return "Erro desconhecido ao contatar o serviço de WhatsApp.";
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    return code ? `${error.message}: ${cause.message} (${code})` : `${error.message}: ${cause.message}`;
  }
  return error.message;
}

/** Lê a configuração do Evolution API das variáveis de ambiente. */
export function getEvolutionConfig(): EvolutionConfig | null {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE;
  if (!apiUrl || !apiKey || !instanceName) return null;
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey, instanceName };
}

export type EvolutionConnectionState = "open" | "connecting" | "close" | "unknown";

export async function getEvolutionConnectionState(config: EvolutionConfig): Promise<EvolutionConnectionState> {
  try {
    const res = await fetch(`${config.apiUrl}/instance/connectionState/${config.instanceName}`, {
      headers: { apikey: config.apiKey },
      cache: "no-store",
    });
    if (!res.ok) return "unknown";
    const json = (await res.json()) as { instance?: { state?: string } };
    const state = json.instance?.state;
    if (state === "open" || state === "connecting" || state === "close") return state;
    return "unknown";
  } catch (error) {
    console.error("[WhatsApp/Evolution] Falha ao consultar connectionState:", describeFetchError(error));
    return "unknown";
  }
}

function extractQrBase64(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const nestedQrcode = obj.qrcode as Record<string, unknown> | undefined;
  const candidates = [obj.base64, nestedQrcode?.base64, obj.code, nestedQrcode?.code];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) {
      return value.startsWith("data:image") ? value : `data:image/png;base64,${value}`;
    }
  }
  return null;
}

/** Busca um QR code para conectar o número. Cria a instância se ela ainda não existir. */
export async function getEvolutionQrCode(config: EvolutionConfig): Promise<{ base64: string } | { error: string }> {
  try {
    const connectRes = await fetch(`${config.apiUrl}/instance/connect/${config.instanceName}`, {
      headers: { apikey: config.apiKey },
      cache: "no-store",
    });

    if (connectRes.ok) {
      const qr = extractQrBase64(await connectRes.json());
      if (qr) return { base64: qr };
      return { error: "A instância já está conectada ou nenhum QR code foi retornado." };
    }

    if (connectRes.status === 404) {
      const createRes = await fetch(`${config.apiUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName: config.instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }),
      });

      if (!createRes.ok) {
        return { error: `HTTP ${createRes.status}: ${await createRes.text()}` };
      }

      const qr = extractQrBase64(await createRes.json());
      if (qr) return { base64: qr };
      return { error: "Instância criada, mas nenhum QR code foi retornado. Tente gerar novamente." };
    }

    return { error: `HTTP ${connectRes.status}: ${await connectRes.text()}` };
  } catch (error) {
    const message = describeFetchError(error);
    console.error("[WhatsApp/Evolution] Falha ao buscar QR code:", message);
    return { error: message };
  }
}

function extractOwnerNumber(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const obj = entry as Record<string, unknown>;
  const nested = obj.instance as Record<string, unknown> | undefined;
  const owner = obj.owner ?? obj.ownerJid ?? nested?.owner ?? nested?.ownerJid;
  if (typeof owner !== "string" || owner.length === 0) return null;
  const digits = owner.split("@")[0].replace(/\D/g, "");
  return digits.length > 0 ? `+${digits}` : null;
}

function matchesInstance(entry: unknown, instanceName: string): boolean {
  if (!entry || typeof entry !== "object") return false;
  const obj = entry as Record<string, unknown>;
  const nested = obj.instance as Record<string, unknown> | undefined;
  const name = obj.instanceName ?? obj.name ?? nested?.instanceName;
  return name === instanceName;
}

/**
 * Busca o número de WhatsApp atualmente conectado à instância (o número real
 * que foi pareado escaneando o QR code), para nunca depender de um número
 * fixo cadastrado manualmente.
 */
export async function getEvolutionConnectedNumber(config: EvolutionConfig): Promise<string | null> {
  try {
    const res = await fetch(`${config.apiUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(config.instanceName)}`, {
      headers: { apikey: config.apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as unknown;
    const list = Array.isArray(json) ? json : [json];
    const match = list.find((entry) => matchesInstance(entry, config.instanceName)) ?? list[0];
    return extractOwnerNumber(match);
  } catch (error) {
    console.error("[WhatsApp/Evolution] Falha ao buscar número conectado:", describeFetchError(error));
    return null;
  }
}

export async function logoutEvolutionInstance(config: EvolutionConfig): Promise<{ ok: true } | { error: string }> {
  try {
    const res = await fetch(`${config.apiUrl}/instance/logout/${config.instanceName}`, {
      method: "DELETE",
      headers: { apikey: config.apiKey },
    });
    if (res.ok) return { ok: true };

    const body = await res.text();

    // O Evolution API pode responder 500 aqui por um bug interno dele ao
    // tentar persistir o evento de exclusão de mensagem gerado pelo logout,
    // mesmo que a sessão já tenha sido desconectada de fato. Confirma o
    // estado real antes de reportar falha para o usuário.
    const state = await getEvolutionConnectionState(config);
    if (state !== "open") return { ok: true };

    return { error: `HTTP ${res.status}: ${body}` };
  } catch (error) {
    const message = describeFetchError(error);
    console.error("[WhatsApp/Evolution] Falha ao desconectar:", message);
    return { error: message };
  }
}
