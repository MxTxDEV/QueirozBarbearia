import { cn } from "@/lib/utils";
import { AppointmentBlock, type BlockData } from "./appointment-block";
import { WEEKDAY_SHORT, isSameDay } from "./calendar-dates";

export type MonthAppointment = {
  block: BlockData;
  actions?: React.ReactNode;
  day: Date;
};

const MAX_VISIBLE_PER_DAY = 3;

/** Grade mensal: semanas em linhas, com os agendamentos resumidos em cada dia. */
export function MonthGrid({
  days,
  appointments,
  month,
  today,
}: {
  days: Date[];
  appointments: MonthAppointment[];
  month: number;
  today: Date;
}) {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAY_SHORT.map((label) => (
            <div key={label} className="px-2 pb-2 text-center text-[11px] uppercase tracking-wide text-foreground-muted">
              {label}
            </div>
          ))}
        </div>

        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => {
                const dayAppointments = appointments.filter((a) => isSameDay(a.day, day));
                const outsideMonth = day.getUTCMonth() !== month;
                const isToday = isSameDay(day, today);
                const hidden = dayAppointments.length - MAX_VISIBLE_PER_DAY;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn("min-h-[104px] border-b border-l p-1.5", outsideMonth && "opacity-40")}
                  >
                    <p
                      className={cn(
                        "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        isToday ? "bg-secondary-dark text-white" : "text-foreground-muted"
                      )}
                    >
                      {day.getUTCDate()}
                    </p>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, MAX_VISIBLE_PER_DAY).map((appt) => (
                        <AppointmentBlock key={appt.block.id} data={appt.block} actions={appt.actions} compact />
                      ))}
                      {hidden > 0 && (
                        <p className="px-1 text-[10px] text-foreground-muted">+{hidden} outro(s)</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
