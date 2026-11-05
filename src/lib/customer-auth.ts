import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CUSTOMER_SESSION_COOKIE = "customer_session_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 ano: o cliente entra uma vez e não precisa repetir
const OTP_TTL_SECONDS = 60 * 10; // 10 minutos
const OTP_ACTIVE_CODES = 3; // códigos recentes ainda válidos (um reenvio não invalida o anterior que chegou atrasado)
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
 * depender de NODE_ENV estar correto no ambiente de deploy.
 *
 * Se um código foi pedido há instantes (duplo clique, ou o cliente voltou à tela),
 * devolve `null`: o código anterior continua valendo e NÃO se manda outra mensagem
 * — antes isso virava um erro "aguarde" e o cliente achava que o login tinha falhado.
 * Os últimos códigos continuam valendo juntos (ver `verifyCustomerOtp`), então um
 * reenvio nunca "queima" o código que chegou atrasado. A força bruta é limitada por
 * `OTP_MAX_ATTEMPTS` em cada código e pelo cooldown entre pedidos.
 */
export async function createCustomerOtp(customerId: string): Promise<string | null> {
  const recent = await prisma.customerOtp.findFirst({
    where: { customerId, consumedAt: null, createdAt: { gt: new Date(Date.now() - OTP_REQUEST_COOLDOWN_SECONDS * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return null;

  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  await prisma.customerOtp.create({ data: { customerId, codeHash, expiresAt } });
  return code;
}

/** Verifica o código informado entre os códigos recentes ainda válidos, com limite de tentativas para impedir força bruta. */
export async function verifyCustomerOtp(customerId: string, code: string) {
  const otps = await prisma.customerOtp.findMany({
    where: { customerId, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: OTP_MAX_ATTEMPTS } },
    orderBy: { createdAt: "desc" },
    take: OTP_ACTIVE_CODES,
  });
  if (otps.length === 0) return false;

  const codeHash = hashToken(code.trim());
  const match = otps.find((otp) => otp.codeHash === codeHash);
  if (!match) {
    await prisma.customerOtp.updateMany({ where: { id: { in: otps.map((o) => o.id) } }, data: { attempts: { increment: 1 } } });
    return false;
  }

  await prisma.customerOtp.updateMany({ where: { customerId, consumedAt: null }, data: { consumedAt: new Date() } });
  return true;
}

/**
 * O cookie só pode ser `secure` se o acesso for por HTTPS de verdade. Atrás do proxy do Coolify o
 * NODE_ENV pode dizer "production" com o site em HTTP — o navegador então descartava o cookie e o
 * cliente caía na tela de login de novo a cada página. Olha o protocolo real (x-forwarded-proto).
 */
async function cookieShouldBeSecure() {
  try {
    const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (proto) return proto === "https";
  } catch {
    // fora de uma requisição
  }
  return process.env.NODE_ENV === "production";
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
    secure: await cookieShouldBeSecure(),
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
