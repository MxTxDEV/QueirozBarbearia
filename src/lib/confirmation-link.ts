import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/app-url";

/**
 * Link público para o cliente confirmar (ou desistir de) um horário, sem precisar entrar na conta:
 * `${endereço do sistema}/confirmar/${token}`. O token é aleatório e fica no agendamento — gerado só
 * quando o primeiro link é necessário e mantido depois (o mesmo link serve em todos os lembretes).
 * Devolve null se o endereço público do sistema não é conhecido (a mensagem sai sem o link).
 */
export async function confirmationUrlFor(appointmentId: string): Promise<string | null> {
  const base = await getAppBaseUrl();
  if (!base) return null;

  let appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { confirmToken: true } });
  if (!appt) return null;
  if (!appt.confirmToken) {
    // Só grava se ainda estiver vazio (dois envios ao mesmo tempo não trocam o token um do outro).
    await prisma.appointment.updateMany({
      where: { id: appointmentId, confirmToken: null },
      data: { confirmToken: randomBytes(18).toString("base64url") },
    });
    appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { confirmToken: true } });
  }
  return appt?.confirmToken ? `${base}/confirmar/${appt.confirmToken}` : null;
}
