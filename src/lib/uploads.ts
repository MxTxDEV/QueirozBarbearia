import "server-only";
import path from "path";
import fs from "fs/promises";

/**
 * Uploads (logo de cada empresa, por enquanto) ficam em disco, fora da
 * pasta `public` — servidos pela própria rota /api/uploads/[...path], não
 * pelo estático do Next. Isso funciona igual em dev e num container Docker
 * (Coolify/VPS), desde que UPLOAD_DIR aponte para um volume persistente —
 * sem isso, os arquivos somem a cada novo deploy.
 */
export function getUploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

// SVG fica de fora de upload direto por segurança: um SVG pode conter
// <script>, e se alguém abrir o link do arquivo direto no navegador (fora
// de uma tag <img>, onde scripts não rodam) esse script executaria no
// nosso domínio. Logo em SVG ainda é possível colando uma URL externa.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export function isUploadedLogoPath(logoUrl: string | null | undefined): logoUrl is string {
  return !!logoUrl && logoUrl.startsWith("/api/uploads/logos/");
}

/** Salva o arquivo de logo enviado e devolve o caminho público para guardar em Company.logoUrl. */
export async function saveUploadedLogo(file: File, companyId: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > MAX_SIZE_BYTES) throw new Error("A imagem deve ter no máximo 2MB.");

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Formato não suportado. Envie PNG, JPG ou WEBP.");

  const dir = path.join(getUploadRoot(), "logos");
  await fs.mkdir(dir, { recursive: true });

  const filename = `${companyId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), buffer);

  return `/api/uploads/logos/${filename}`;
}

/** Remove um logo enviado anteriormente (nunca mexe em logos que são URL externa). */
export async function deleteUploadedLogo(logoUrl: string | null | undefined) {
  if (!isUploadedLogoPath(logoUrl)) return;

  const logosDir = path.join(getUploadRoot(), "logos");
  const filePath = path.join(logosDir, path.basename(logoUrl));
  if (!filePath.startsWith(logosDir + path.sep)) return; // defesa extra contra path traversal

  await fs.unlink(filePath).catch(() => {});
}
