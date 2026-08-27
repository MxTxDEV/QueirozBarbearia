"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { createGoalAction } from "@/actions/goals";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";

export function GoalForm({ barbers }: { barbers: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(createGoalAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Título *</Label>
        <Input id="title" name="title" required placeholder="Ex: Faturamento de agosto" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">Tipo *</Label>
        <Select id="type" name="type" required defaultValue="REVENUE">
          <option value="REVENUE">Faturamento</option>
          <option value="APPOINTMENTS">Atendimentos</option>
          <option value="BARBER_REVENUE">Faturamento por barbeiro</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="barberId">Barbeiro (para meta por barbeiro)</Label>
        <Select id="barberId" name="barberId">
          <option value="">—</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="targetValue">Meta (valor ou nº de atendimentos) *</Label>
        <Input id="targetValue" name="targetValue" type="number" step="0.01" min="0" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="startDate">Início *</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endDate">Fim *</Label>
        <Input id="endDate" name="endDate" type="date" required />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Meta criada!</p>}
      <SubmitButton pendingText="Salvando...">Criar meta</SubmitButton>
    </form>
  );
}
