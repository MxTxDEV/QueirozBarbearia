"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { checkAppointmentEditAction, getAppointmentEditDataAction, updateAppointmentAction, type EditAppointmentData } from "@/actions/appointment-edit";
import { EDIT_MAX_DURATION_MIN, EDIT_MIN_DURATION_MIN, sameServiceSet } from "@/lib/appointment-edit";
import { formatCurrency } from "@/lib/utils";

type FormState = {
  customerId: string;
  walkInName: string;
  barberId: string;
  date: string;
  time: string;
  /** Texto do campo (vazio enquanto o usuário digita). */
  duration: string;
  serviceIds: string[];
  notes: string;
};

type Check = { key: string; available: boolean; message?: string; endLabel: string; unchanged?: boolean };

/** Fica de fora do alcance dos arrastes/cliques da linha ou do cartão em que o botão está (o portal propaga eventos pela árvore do React). */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Botão "Editar" + janela de edição de um agendamento pendente/confirmado: cliente, barbeiro, data,
 * horário, duração, serviços e observação. Os dados vêm do servidor ao abrir; a janela avisa na hora se
 * o novo horário já está ocupado e só deixa salvar quando está livre (o servidor confere de novo).
 */
export function EditAppointmentButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="contents" onClick={stop} onPointerDown={stop} onMouseDown={stop} onTouchStart={stop} onDragStart={stop} onKeyDown={stop}>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} aria-label="Editar agendamento" title="Editar cliente, data, horário, barbeiro, serviços e observação">
        <Pencil className="h-4 w-4" /> Editar
      </Button>
      {open && <EditDialog id={id} onClose={() => setOpen(false)} />}
    </span>
  );
}

function EditDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<EditAppointmentData | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getAppointmentEditDataAction(id).then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setLoadError(!result.ok ? result.error : "Não foi possível carregar o agendamento.");
        return;
      }
      const d = result.data;
      setData(d);
      setForm({
        customerId: d.customerId ?? "",
        walkInName: d.walkInName ?? "",
        barberId: d.barberId,
        date: d.date,
        time: d.time,
        duration: String(d.durationMin),
        serviceIds: d.serviceIds,
        notes: d.notes,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const durationMin = form ? Number(form.duration) : NaN;
  const durationValid = Number.isInteger(durationMin) && durationMin >= EDIT_MIN_DURATION_MIN && durationMin <= EDIT_MAX_DURATION_MIN;
  const localError = useMemo(() => {
    if (!data || !form) return null;
    if (data.customerId === null && !form.walkInName.trim()) return "Informe o nome do cliente.";
    if (data.customerId !== null && !form.customerId) return "Escolha o cliente.";
    if (!form.date) return "Informe a data.";
    if (!form.time) return "Informe o horário.";
    if (!durationValid) return `A duração deve ficar entre ${EDIT_MIN_DURATION_MIN} e ${EDIT_MAX_DURATION_MIN} minutos.`;
    if (form.serviceIds.length === 0) return "Escolha ao menos um serviço.";
    return null;
  }, [data, form, durationValid]);

  // Chave do que o servidor precisa conferir: muda → a resposta antiga deixa de valer ("verificando…").
  const key = form ? JSON.stringify([form.customerId, form.walkInName, form.barberId, form.date, form.time, form.duration, [...form.serviceIds].sort(), form.notes]) : "";

  useEffect(() => {
    if (!form || !data || localError) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkAppointmentEditAction({
        appointmentId: data.id,
        customerId: data.customerId ? form.customerId : null,
        walkInName: data.customerId ? null : form.walkInName,
        barberId: form.barberId,
        date: form.date,
        time: form.time,
        durationMin,
        serviceIds: form.serviceIds,
        notes: form.notes,
      });
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setCheck({ key, available: false, message: !result.ok ? result.error : "Não foi possível verificar o horário.", endLabel: "" });
        return;
      }
      setCheck({ key, ...result.data });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `key` resume todos os campos do formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, localError]);

  function update(patch: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  const barber = data?.barbers.find((b) => b.id === form?.barberId);

  function toggleService(serviceId: string) {
    if (!data || !form) return;
    const next = form.serviceIds.includes(serviceId) ? form.serviceIds.filter((s) => s !== serviceId) : [...form.serviceIds, serviceId];
    // Mesmos serviços de antes: volta a duração original (que pode ter sido esticada na agenda);
    // serviços diferentes: a duração passa a ser a soma deles (ainda dá para ajustar no campo).
    const duration = sameServiceSet(next, data.serviceIds)
      ? data.durationMin
      : next.reduce((sum, sid) => sum + (data.services.find((s) => s.id === sid)?.durationMinutes ?? 0), 0);
    update({ serviceIds: next, duration: String(duration) });
  }

  const checkIsCurrent = check?.key === key;
  const busy = checkIsCurrent && !check.available;
  const unchanged = checkIsCurrent && check.unchanged === true;
  const checking = !localError && !checkIsCurrent;
  const canSave = Boolean(form) && !localError && checkIsCurrent && check.available && !unchanged && !saving;

  // Os serviços que o agendamento já tem vêm primeiro (a ordem não muda ao marcar/desmarcar).
  const orderedServices = useMemo(() => {
    if (!data) return [];
    const initial = new Set(data.serviceIds);
    return [...data.services].sort((a, b) => Number(initial.has(b.id)) - Number(initial.has(a.id)));
  }, [data]);

  const newTotal = useMemo(() => {
    if (!data || !form || sameServiceSet(form.serviceIds, data.serviceIds)) return null;
    return form.serviceIds.reduce((sum, sid) => sum + (data.services.find((s) => s.id === sid)?.price ?? 0), 0);
  }, [data, form]);

  function save() {
    if (!data || !form || !canSave) return;
    startSaving(async () => {
      const result = await updateAppointmentAction({
        appointmentId: data.id,
        customerId: data.customerId ? form.customerId : null,
        walkInName: data.customerId ? null : form.walkInName,
        barberId: form.barberId,
        date: form.date,
        time: form.time,
        durationMin,
        serviceIds: form.serviceIds,
        notes: form.notes,
      });
      if (!result.ok) {
        toast.error(result.error);
        // O servidor é quem manda: refaz a conferência para a janela mostrar o motivo.
        setCheck({ key, available: false, message: result.error, endLabel: "" });
        return;
      }
      toast.success("Agendamento atualizado.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal title="Editar agendamento" icon={<Pencil className="h-5 w-5 text-secondary-light" />} onClose={onClose} busy={saving} className="max-w-lg">
      {loadError ? (
        <div className="space-y-4">
          <p className="text-sm text-danger">{loadError}</p>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : !data || !form ? (
        <p className="text-sm text-foreground-muted">Carregando…</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-client-${id}`}>Cliente</Label>
            {data.customerId !== null ? (
              <Select id={`edit-client-${id}`} value={form.customerId} onChange={(e) => update({ customerId: e.target.value })} disabled={saving}>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id={`edit-client-${id}`} value={form.walkInName} maxLength={80} onChange={(e) => update({ walkInName: e.target.value })} placeholder="Nome do cliente (sem cadastro)" disabled={saving} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`edit-barber-${id}`}>Barbeiro</Label>
            <Select id={`edit-barber-${id}`} value={form.barberId} onChange={(e) => update({ barberId: e.target.value })} disabled={saving || data.barbers.length < 2}>
              {data.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 space-y-1.5 sm:col-span-1">
              <Label htmlFor={`edit-date-${id}`}>Data</Label>
              <Input id={`edit-date-${id}`} type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} disabled={saving} />
            </div>
            <div className="col-span-3 space-y-1.5 sm:col-span-1">
              <Label htmlFor={`edit-time-${id}`}>Horário</Label>
              <Input id={`edit-time-${id}`} type="time" value={form.time} onChange={(e) => update({ time: e.target.value })} disabled={saving} />
            </div>
            <div className="col-span-3 space-y-1.5 sm:col-span-1">
              <Label htmlFor={`edit-duration-${id}`}>Duração (min)</Label>
              <Input
                id={`edit-duration-${id}`}
                type="number"
                inputMode="numeric"
                min={EDIT_MIN_DURATION_MIN}
                max={EDIT_MAX_DURATION_MIN}
                step={5}
                value={form.duration}
                onChange={(e) => update({ duration: e.target.value })}
                disabled={saving}
              />
            </div>
          </div>

          <p
            role="status"
            aria-live="polite"
            className={
              localError || busy
                ? "rounded-xl border border-danger/40 bg-[var(--badge-danger-bg)] px-3 py-2 text-sm text-danger"
                : "rounded-xl border bg-[var(--surface-subtle)] px-3 py-2 text-sm text-foreground-muted"
            }
          >
            {localError
              ? localError
              : checking
                ? "Verificando disponibilidade…"
                : busy
                  ? check.message
                  : unchanged
                    ? "Nenhuma alteração ainda."
                    : <span className="text-success">✓ Horário livre — termina às {check?.endLabel}.</span>}
          </p>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground-muted">Serviços</legend>
            {!data.canEditServices && (
              <p className="text-xs text-foreground-muted">Esse agendamento já tem pagamento registrado — os serviços não podem ser trocados.</p>
            )}
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {orderedServices.map((service) => {
                const checked = form.serviceIds.includes(service.id);
                const offered = barber ? barber.serviceIds.includes(service.id) : true;
                // Serviço que o barbeiro não faz só fica marcável para desmarcar.
                const disabled = saving || !data.canEditServices || (!offered && !checked);
                return (
                  <label
                    key={service.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                      checked ? "border-secondary bg-secondary/15" : "bg-[var(--surface-subtle)]"
                    } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleService(service.id)} className="h-4 w-4 accent-[var(--color-secondary)]" />
                      <span className="text-foreground">
                        {service.name}
                        {!service.active && <span className="text-foreground-muted"> (inativo)</span>}
                        {!offered && <span className="text-foreground-muted"> · {barber?.name ?? "o barbeiro"} não faz</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-foreground-muted">
                      {formatCurrency(service.price)} · {service.durationMinutes} min
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-foreground-muted">
              {newTotal !== null ? `Novo total: ${formatCurrency(newTotal)} (antes ${formatCurrency(data.price)})` : `Total: ${formatCurrency(data.price)}`}
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor={`edit-notes-${id}`}>Observação</Label>
            <Textarea id={`edit-notes-${id}`} value={form.notes} maxLength={500} rows={2} onChange={(e) => update({ notes: e.target.value })} placeholder="Opcional" disabled={saving} />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={save} disabled={!canSave}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
