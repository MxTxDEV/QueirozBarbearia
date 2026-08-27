import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "session_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const session = await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  const jwt = await new SignJWT({ sid: session.id, sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  cookieStore.delete(SESSION_COOKIE);

  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.sid) {
      await prisma.session.updateMany({
        where: { id: payload.sid as string, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  } catch {
    // token inválido, nada a revogar
  }
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  barberId: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const sessionId = payload.sid as string;
    const userId = payload.sub as string;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { barber: { select: { id: true } } },
    });
    if (!user || !user.active) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      barberId: user.barber?.id ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autenticado.");
  if (roles && !roles.includes(user.role)) throw new Error("Acesso não autorizado.");
  return user;
}
