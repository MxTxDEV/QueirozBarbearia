import { Clock } from "lucide-react";
import type { Appointment, AppointmentService, Barber, Customer } from "@prisma/client";
import { formatTime } from "@/lib/utils";

type NextAppointmentData = (Appointment & { customer: Customer; barber: Barber; services: AppointmentService[] }) | null;

function minutesUntil(date: Date) {
  return Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
}

export function NextAppointment({ appointment }: { appointment: NextAppointmentData }) {
  if (!appointment) {
    return (
      <div className="glass rounded-3xl p-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted">Próximo atendimento</p>
        <p className="mt-8 text-center text-sm text-foreground-muted">Nenhum próximo horário agendado.</p>
      </div>
    );
  }

  const minutes = minutesUntil(appointment.startTime);
  const when = minutes === 0 ? "agora" : minutes < 60 ? `em ${minutes} min` : `às ${formatTime(appointment.startTime)}`;

  return (
    <div className="glass-strong relative overflow-hidden rounded-3xl p-6">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--secondary) 0%, transparent 70%)" }}
      />
      <div className="relative flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-secondary-light">
        <Clock className="h-3.5 w-3.5" />
        Próximo atendimento
      </div>
      <p className="relative mt-3 text-3xl font-semibold tracking-tight text-foreground">{formatTime(appointment.startTime)}</p>
      <p className="relative mt-0.5 text-sm text-foreground-muted">{when}</p>
      <div className="relative mt-4 space-y-1">
        <p className="text-base font-medium text-foreground">{appointment.customer.fullName}</p>
        <p className="text-sm text-foreground-muted">{appointment.services.map((s) => s.serviceName).join(", ")}</p>
        <p className="text-sm text-foreground-muted">
          Barbeiro: <span className="text-foreground">{appointment.barber.name}</span>
        </p>
      </div>
    </div>
  );
}
