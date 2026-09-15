/**
 * Funções puras (sem acesso a banco) do motor da lista de espera — mesma
 * separação de src/lib/availability-helpers.ts, pelo mesmo motivo: testáveis
 * direto, sem "server-only" e sem tocar Prisma.
 */

/**
 * Minutos que uma vaga oferecida fica reservada só pra um cliente antes de
 * voltar pra fila. Único lugar onde esse número aparece — nunca espalhar
 * o literal 15 pelo código (ver src/lib/waitlist.ts).
 */
export const WAITLIST_HOLD_DURATION_MINUTES = 15;

/** Janela [min, max] que o cliente aceita, em torno do horário preferido. */
export function toleranceWindow(preferredTime: Date, toleranceMinutes: number): { min: Date; max: Date } {
  const toleranceMs = toleranceMinutes * 60_000;
  return {
    min: new Date(preferredTime.getTime() - toleranceMs),
    max: new Date(preferredTime.getTime() + toleranceMs),
  };
}

export function isWithinTolerance(candidate: Date, preferredTime: Date, toleranceMinutes: number): boolean {
  const { min, max } = toleranceWindow(preferredTime, toleranceMinutes);
  return candidate >= min && candidate <= max;
}

/**
 * Dado os horários livres de um dia (já calculados pelo motor de
 * disponibilidade) e a preferência de um cliente, acha o horário livre mais
 * próximo do preferido dentro da tolerância. Em empate de distância, o mais
 * cedo vence (determinístico). Retorna null se nenhum horário livre cai
 * dentro da tolerância.
 */
export function findClosestAvailableSlot<T extends { start: Date }>(
  preferredTime: Date,
  toleranceMinutes: number,
  availableSlots: readonly T[]
): T | null {
  let best: T | null = null;
  let bestDistanceMs = Infinity;

  for (const slot of availableSlots) {
    if (!isWithinTolerance(slot.start, preferredTime, toleranceMinutes)) continue;
    const distanceMs = Math.abs(slot.start.getTime() - preferredTime.getTime());
    if (distanceMs < bestDistanceMs || (distanceMs === bestDistanceMs && best && slot.start < best.start)) {
      best = slot;
      bestDistanceMs = distanceMs;
    }
  }

  return best;
}

/** Um candidato da lista de espera já resolvido contra uma vaga específica, pronto pra ser ordenado por prioridade. */
export type WaitlistCandidateMatch = {
  entryId: string;
  /** O horário oferecido bate exatamente com o horário preferido do cliente. */
  exactTimeMatch: boolean;
  /** O cliente pediu especificamente este barbeiro (não "qualquer barbeiro"). */
  requestedThisBarber: boolean;
  /** |horário oferecido - horário preferido|, em ms. */
  distanceMs: number;
  createdAt: Date;
};

/**
 * Ordem determinística de prioridade (nunca aleatória) quando mais de um
 * cliente da lista de espera é compatível com a mesma vaga:
 * 1. horário exato bate com o preferido
 * 2. pediu especificamente este barbeiro
 * 3. menor distância até o horário preferido
 * 4. entrou primeiro na lista (createdAt mais antigo)
 * 5. desempate final por id, só pra garantir uma ordem 100% estável mesmo
 *    no caso extremo de dois registros com timestamps idênticos.
 */
export function compareWaitlistCandidateMatches(a: WaitlistCandidateMatch, b: WaitlistCandidateMatch): number {
  if (a.exactTimeMatch !== b.exactTimeMatch) return a.exactTimeMatch ? -1 : 1;
  if (a.requestedThisBarber !== b.requestedThisBarber) return a.requestedThisBarber ? -1 : 1;
  if (a.distanceMs !== b.distanceMs) return a.distanceMs - b.distanceMs;
  const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
  if (createdDiff !== 0) return createdDiff;
  return a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0;
}

/** Ordena candidatos compatíveis pela prioridade acima; o primeiro da lista é quem deve receber a oferta. */
export function rankWaitlistCandidateMatches(matches: readonly WaitlistCandidateMatch[]): WaitlistCandidateMatch[] {
  return [...matches].sort(compareWaitlistCandidateMatches);
}
