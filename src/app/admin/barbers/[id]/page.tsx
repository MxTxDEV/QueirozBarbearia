import { notFound } from "next/navigation";
import Link from "next/link";
import { getBarberDetail } from "@/lib/data/barbers";
import { listServices } from "@/lib/data/services";
import { weekdayName, formatDate } from "@/lib/utils";
import {
  createTimeOffAction,
  removeTimeOffAction,
  removeWorkingHourAction,
  toggleBarberActiveAction,
  toggleBarberServiceAction,
  upsertWorkingHourAction,
} from "@/actions/barbers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToggleActiveButton } from "../../services/toggle-active-button";

export default async function BarberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [barber, services] = await Promise.all([getBarberDetail(id), listServices()]);
  if (!barber) notFound();

  const hoursByWeekday = new Map(barber.workingHours.map((h) => [h.weekday, h]));
  const enabledServiceIds = new Set(barber.services.map((s) => s.serviceId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-secondary-light to-secondary-dark text-xl font-semibold text-white">
            {barber.name.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{barber.name}</h1>
            <p className="text-sm text-foreground-muted">{barber.specialties.join(", ") || "Sem especialidades"}</p>
          </div>
          <Badge variant={barber.active ? "success" : "muted"}>{barber.active ? "Ativo" : "Inativo"}</Badge>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/barbers/${id}/edit`}>
            <Button variant="secondary">Editar dados</Button>
          </Link>
          <ToggleActiveButton id={id} active={barber.active} action={toggleBarberActiveAction} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Horário de trabalho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 7 }).map((_, weekday) => {
              const hour = hoursByWeekday.get(weekday);
              const action = async (formData: FormData) => {
                "use server";
                await upsertWorkingHourAction(id, formData);
              };
              return (
                <form
                  key={weekday}
                  action={action}
                  className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 p-3"
                >
                  <input type="hidden" name="weekday" value={weekday} />
                  <span className="w-24 shrink-0 pb-2 text-sm font-medium text-foreground">{weekdayName(weekday)}</span>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Início</Label>
                    <Input name="startTime" type="time" defaultValue={hour?.startTime ?? "09:00"} className="w-28" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Fim</Label>
                    <Input name="endTime" type="time" defaultValue={hour?.endTime ?? "19:00"} className="w-28" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Almoço início</Label>
                    <Input name="breakStart" type="time" defaultValue={hour?.breakStart ?? ""} className="w-28" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Almoço fim</Label>
                    <Input name="breakEnd" type="time" defaultValue={hour?.breakEnd ?? ""} className="w-28" />
                  </div>
                  <SubmitButton size="sm" variant="secondary" pendingText="...">
                    {hour ? "Salvar" : "Ativar dia"}
                  </SubmitButton>
                  {hour && (
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      formAction={removeWorkingHourAction.bind(null, id, weekday)}
                    >
                      Folga
                    </Button>
                  )}
                </form>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Serviços realizados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {services.map((s) => {
                const enabled = enabledServiceIds.has(s.id);
                return (
                  <form
                    key={s.id}
                    action={toggleBarberServiceAction.bind(null, id, s.id, !enabled)}
                    className="flex items-center justify-between rounded-xl border border-white/10 p-2.5"
                  >
                    <span className="text-sm text-foreground">{s.name}</span>
                    <Button type="submit" size="sm" variant={enabled ? "secondary" : "outline"}>
                      {enabled ? "Habilitado" : "Habilitar"}
                    </Button>
                  </form>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Folgas e férias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await createTimeOffAction(id, formData);
                }}
                className="grid grid-cols-2 gap-2"
              >
                <Input name="startDate" type="date" required />
                <Input name="endDate" type="date" required />
                <Input name="reason" placeholder="Motivo (opcional)" className="col-span-2" />
                <SubmitButton size="sm" className="col-span-2" pendingText="Salvando...">
                  Adicionar bloqueio
                </SubmitButton>
              </form>
              <div className="space-y-2">
                {barber.timeOffs.length === 0 && <p className="text-sm text-foreground-muted">Nenhuma folga cadastrada.</p>}
                {barber.timeOffs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 p-2.5 text-sm">
                    <span className="text-foreground-muted">
                      {formatDate(t.startDate)} — {formatDate(t.endDate)} {t.reason ? `(${t.reason})` : ""}
                    </span>
                    <form action={removeTimeOffAction.bind(null, id, t.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        Remover
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
