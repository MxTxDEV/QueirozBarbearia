/**
 * Nome a exibir para o cliente de um agendamento: o cadastrado, ou — quando o
 * agendamento foi criado sem cliente cadastrado — o nome avulso digitado.
 */
export function appointmentClientName(appt: {
  customer?: { fullName: string } | null;
  walkInName?: string | null;
}): string {
  return appt.customer?.fullName ?? appt.walkInName ?? "Cliente avulso";
}
