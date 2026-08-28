import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getUploadRoot } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** Serve os arquivos enviados (logo por empresa, por enquanto) direto do disco — nunca sai da pasta UPLOAD_DIR. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const root = getUploadRoot();
  const resolved = path.resolve(root, ...segments);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  try {
    const data = await fs.readFile(resolved);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
}
