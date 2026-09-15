"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateBarberBlockAction, deleteBarberBlockAction } from "@/actions/barber-blocks";
import type { ActionResult } from "@/lib/action-helpers";
import { formatDate, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BarberBlock = { id: string; date: Date; startTime: Date; endTime: Date; reason: string | null };

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toTimeInputValue(d: Date) {
  return d.toISOString().slice(11, 16);
}

export function BarberBlockRow({ barberId, block }: { barberId: string; block: BarberBlock }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(async (_prev, formData) => {
    const result = await updateBarberBlockAction(barberId, block.id, _prev, formData);
    if (result.ok) setEditing(false);
    return result;
  }, undefined);

  function remove() {
    if (!confirm("Excluir este bloqueio? O horário volta a ficar disponível normalmente.")) return;
    startTransition(async () => {
      const result = await deleteBarberBlockAction(barberId, block.id);
      if (result.ok) toast.success("Bloqueio excluído.");
      else toast.error(result.error);
    });
  }

  if (editing) {
    return (
      <form action={formAction} className="space-y-2 rounded-xl border p-2.5">
        <div className="grid grid-cols-3 gap-2">
          <Input name="date" type="date" defaultValue={toDateInputValue(block.date)} required />
          <Input name="startTime" type="time" defaultValue={toTimeInputValue(block.startTime)} required />
          <Input name="endTime" type="time" defaultValue={toTimeInputValue(block.endTime)} required />
        </div>
        <Input name="reason" placeholder="Motivo (opcional)" defaultValue={block.reason ?? ""} />
        {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Salvar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border p-2.5 text-sm">
      <span className="text-foreground-muted">
        {formatDate(block.date)}, {formatTime(block.startTime)}–{formatTime(block.endTime)}
        {block.reason ? ` (${block.reason})` : ""}
      </span>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={remove}>
          Excluir
        </Button>
      </div>
    </div>
  );
}
