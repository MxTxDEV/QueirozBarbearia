"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { adminEditFutureOccurrencesAction } from "@/actions/recurring-appointments";

type Option = { occurrenceId: string; label: string };

export function EditFuturePanel({ seriesId, options }: { seriesId: string; options: Option[] }) {
  const [open, setOpen] = useState(false);
  const [fromOccurrenceId, setFromOccurrenceId] = useState(options[0]?.occurrenceId ?? "");
  const [newStartTime, setNewStartTime] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (options.length === 0) return null;

  function submit() {
    if (!/^\d{2}:\d{2}$/.test(newStartTime)) {
      toast.error("Informe o novo horário.");
      return;
    }
    startTransition(async () => {
      const result = await adminEditFutureOccurrencesAction(seriesId, fromOccurrenceId, newStartTime);
      if (result.ok) {
        toast.success(`${result.data!.regenerated} ocorrência(s) atualizada(s).`);
        setOpen(false);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Alterar horário desta e das próximas
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="text-sm text-foreground-muted">
        Muda o horário de uma ocorrência em diante — as datas continuam as mesmas, só o horário do dia muda. Ocorrências já
        confirmadas nesse intervalo são canceladas (liberando a vaga) e recriadas no novo horário.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={fromOccurrenceId} onChange={(e) => setFromOccurrenceId(e.target.value)} className="w-auto">
          {options.map((o) => (
            <option key={o.occurrenceId} value={o.occurrenceId}>
              A partir de: {o.label}
            </option>
          ))}
        </Select>
        <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="w-28" />
        <Button size="sm" disabled={pending} onClick={submit}>
          Aplicar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
