/**
 * Função pura (sem acesso a banco) usada pelo cálculo de progresso de metas
 * em src/lib/data/goals.ts. Separada num módulo próprio, sem
 * `import "server-only"`, justamente para poder ser testada diretamente
 * (ver src/lib/__tests__/goal-date-range.test.ts) — o mesmo padrão adotado
 * em availability-helpers.ts.
 *
 * `endDate` é armazenado como meia-noite UTC do dia final (vindo de um
 * `<input type="date">`). Um filtro `lte: endDate` excluiria qualquer
 * transação/agendamento com horário posterior à meia-noite nesse mesmo dia —
 * ou seja, o dia inteiro da meta seria descontado silenciosamente. Usamos o
 * início do dia seguinte como limite exclusivo para cobrir o dia final por completo.
 */
export function endOfGoalDay(endDate: Date): Date {
  return new Date(endDate.getTime() + 86_400_000);
}
