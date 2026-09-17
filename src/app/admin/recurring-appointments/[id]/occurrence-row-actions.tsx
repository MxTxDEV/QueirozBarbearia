"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCancelOccurrenceAction, adminEditOccurrenceAction } from "@/actions/recurring-appointments";
import type { RecurringOccurrenceStatus } from "@prisma/client";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toTimeInputValue(d: Date) {
  return d.toISOString().slice(11, 16);
}

export function OccurrenceRowActions({
  occurrenceId,
  status,
  scheduledDate,
  scheduledStartTime,
}: {
  occurrenceId: string;
  status: RecurringOccurrenceStatus;
  scheduledDate: Date;
  scheduledStartTime: Date;
}) {
  const [editing, setEditing] = useState(false);
  const [newDate, setNewDate] = useState(toDateInputValue(scheduledDate));
  const [newTime, setNewTime] = useState(toTimeInputValue(scheduledStartTime));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isActive = status === "PENDING" || status === "CONFIRMED" || status === "CONFLICT" || status === "WAITING_LIST";
  if (!isActive) return null;

  function cancelOccurrence() {
    if (!confirm("Cancelar só esta ocorrência? A recorrência continua ativa nas demais datas.")) return;
    startTransition(async () => {
      const result = await adminCancelOccurrenceAction(occurrenceId);
      if (result.ok) {
        toast.success("Ocorrência cancelada.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function saveEdit() {
    startTransition(async () => {
      const result = await adminEditOccurrenceAction(occurrenceId, { newDate, newStartTime: newTime });
      if (result.ok) {
        toast.success(
          result.data!.status === "CONFIRMED"
            ? "Ocorrência alterada e confirmada."
            : "Ocorrência alterada, mas o novo horário ficou indisponível."
        );
        setEditing(false);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-8 w-36" />
        <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-8 w-24" />
        <Button size="sm" disabled={pending} onClick={saveEdit}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Alterar
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={cancelOccurrence}>
        Cancelar
      </Button>
    </div>
  );
}
