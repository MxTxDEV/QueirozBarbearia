import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CUSTOMER_SESSION_COOKIE = "customer_session_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 dias
const OTP_TTL_SECONDS = 60 * 5; // 5 minutos

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Gera e persiste um código OTP para login do cliente via WhatsApp.
 * Em desenvolvimento (sem provedor real), o código é apenas logado/mockado —
 * ver `src/lib/whatsapp`.
 */
export async function createCustomerOtp(customerId: string) {
  const code = process.env.NODE_ENV === "production"
    ? String(crypto.randomInt(100000, 999999))
    : "123456";
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await prisma.customerOtp.create({ data: { customerId, codeHash, expiresAt } });
  return code;
}

export async function verifyCustomerOtp(customerId: string, code: string) {
  const codeHash = hashToken(code);
  const otp = await prisma.customerOtp.findFirst({
    where: { customerId, codeHash, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return false;
  await prisma.customerOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return true;
}

export async function createCustomerSession(customerId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const session = await prisma.customerSession.create({
    data: { customerId, tokenHash, expiresAt },
  });

  const jwt = await new SignJWT({ sid: session.id, sub: customerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function destroyCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);

  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.sid) {
      await prisma.customerSession.updateMany({
        where: { id: payload.sid as string, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  } catch {
    // token inválido
  }
}

/** companyId identifica a empresa da qual esse cliente é cliente — vem sempre do banco, nunca de input. */
export type CurrentCustomer = {
  id: string;
  companyId: string;
  fullName: string;
  whatsapp: string;
  email: string | null;
};

export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const sessionId = payload.sid as string;
    const customerId = payload.sub as string;

    const session = await prisma.customerSession.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { company: { select: { status: true } } },
    });
    if (!customer) return null;
    if (customer.company.status === "BLOCKED" || customer.company.status === "SUSPENDED") return null;

    return {
      id: customer.id,
      companyId: customer.companyId,
      fullName: customer.fullName,
      whatsapp: customer.whatsapp,
      email: customer.email,
    };
  } catch {
    return null;
  }
}

export async function requireCustomer(): Promise<CurrentCustomer> {
  const customer = await getCurrentCustomer();
  if (!customer) throw new Error("Não autenticado.");
  return customer;
}
