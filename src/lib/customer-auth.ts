import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CUSTOMER_SESSION_COOKIE = "customer_session_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 dias
const OTP_TTL_SECONDS = 60 * 5; // 5 minutos
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_COOLDOWN_SECONDS = 30;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Gera e persiste um código OTP para login do cliente via WhatsApp. O código
 * é sempre aleatório — nunca previsível, mesmo em desenvolvimento — para não
 * depender de NODE_ENV estar correto no ambiente de deploy (já vimos esse
 * valor vir mal configurado pelo provedor de hospedagem). Em desenvolvimento,
 * o provedor mock já loga a mensagem inteira (com o código) no console — ver
 * `src/lib/whatsapp/mock-provider.ts`.
 *
 * Aplica um cooldown entre solicitações e invalida qualquer OTP anterior
 * ainda válido, para que só exista um código ativo por cliente — isso limita
 * o total de tentativas de força bruta possíveis por janela de tempo (ver
 * `OTP_MAX_ATTEMPTS` em `verifyCustomerOtp`).
 */
export async function createCustomerOtp(customerId: string) {
  const recent = await prisma.customerOtp.findFirst({
    where: { customerId, createdAt: { gt: new Date(Date.now() - OTP_REQUEST_COOLDOWN_SECONDS * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) throw new Error("Aguarde um momento antes de solicitar um novo código.");

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await prisma.customerOtp.updateMany({
    where: { customerId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.customerOtp.create({ data: { customerId, codeHash, expiresAt } });
  return code;
}

/** Verifica o código informado, com limite de tentativas por OTP gerado para impedir força bruta. */
export async function verifyCustomerOtp(customerId: string, code: string) {
  const otp = await prisma.customerOtp.findFirst({
    where: { customerId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) return false;

  const codeHash = hashToken(code);
  if (codeHash !== otp.codeHash) {
    await prisma.customerOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }

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
  birthDate: Date | null;
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
      birthDate: customer.birthDate,
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
