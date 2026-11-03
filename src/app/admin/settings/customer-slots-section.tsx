"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateCustomerSlotsAction } from "@/actions/settings";
import { CUSTOMER_SLOT_STEP_MAX, CUSTOMER_SLOT_STEP_MIN, customerSlotExamples, isValidHHMM, type CustomerSlotConfig } from "@/lib/customer-slots";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

/** Atalhos de intervalo — o campo aceita qualquer valor entre o mínimo e o máximo. */
const PRESETS = [15, 20, 30, 45, 60];

/**
 * Horários que o cliente vê ao agendar pelo link. O painel da barbearia não muda (todos os horários, de
 * 15 em 15 minutos); aqui a barbearia escolhe de quanto em quanto tempo o cliente pode marcar e a partir
 * de que hora essa contagem começa.
 */
export function CustomerSlotsSection({ current }: { current: CustomerSlotConfig }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(updateCustomerSlotsAction, undefined);
  const [step, setStep] = useState(String(current.stepMin));
  const [useShopStart, setUseShopStart] = useState(current.startHHMM === null);
  const [start, setStart] = useState(current.startHHMM ?? "08:00");

  const stepNumber = Number(step);
  const stepValid = Number.isInteger(stepNumber) && stepNumber >= CUSTOMER_SLOT_STEP_MIN && stepNumber <= CUSTOMER_SLOT_STEP_MAX;
  const startValid = useShopStart || isValidHHMM(start);

  const examples = useMemo(
    () => (stepValid && startValid ? customerSlotExamples({ stepMin: stepNumber, startHHMM: useShopStart ? null : start }, "08:00", 6) : []),
    [stepValid, startValid, stepNumber, useShopStart, start]
  );

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-sm text-foreground-muted">
        Define quais horários o <strong className="font-medium text-foreground">cliente</strong> vê ao agendar pelo seu link. No painel da barbearia
        continuam todos os horários, de 15 em 15 minutos.
      </p>

      <div className="space-y-2">
        <Label htmlFor="stepMin">Mostrar um horário a cada (minutos)</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="stepMin"
            name="stepMin"
            type="number"
            inputMode="numeric"
            min={CUSTOMER_SLOT_STEP_MIN}
            max={CUSTOMER_SLOT_STEP_MAX}
            step={5}
            required
            value={step}
            onChange={(e) => setStep(e.target.value)}
            className="w-28"
            aria-describedby="slots-preview"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atalhos de intervalo">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setStep(String(preset))}
                aria-pressed={stepNumber === preset}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  stepNumber === preset ? "border-secondary bg-secondary/15 text-foreground" : "text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                }`}
              >
                {preset} min
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="start">Começar a contar às</Label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="useShopStart"
            checked={useShopStart}
            onChange={(e) => setUseShopStart(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-secondary)]"
          />
          No início do expediente de cada barbeiro
        </label>
        {!useShopStart && (
          <div className="flex items-center gap-2">
            <Input id="start" name="start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
            <span className="text-xs text-foreground-muted">O cliente não vê horários antes desta hora.</span>
          </div>
        )}
      </div>

      <div id="slots-preview" role="status" aria-live="polite" className="rounded-xl border bg-[var(--surface-subtle)] p-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Como o cliente vai ver</p>
        {examples.length > 0 ? (
          <>
            <p className="mt-1 flex flex-wrap gap-1.5">
              {examples.map((time) => (
                <span key={time} className="rounded-lg border bg-[var(--background-elevated)] px-2 py-1 font-medium text-foreground">
                  {time}
                </span>
              ))}
              <span className="px-1 py-1 text-foreground-muted">…</span>
            </p>
            <p className="mt-2 text-xs text-foreground-muted">
              {useShopStart
                ? "Exemplo para um barbeiro que abre às 08:00 — cada barbeiro conta a partir da própria abertura."
                : "A sequência é a mesma para todos os barbeiros; só aparecem os horários livres que cabem no expediente."}
            </p>
          </>
        ) : (
          <p className="mt-1 text-danger">
            {stepValid ? "Informe a hora em que a contagem começa." : `Use um intervalo entre ${CUSTOMER_SLOT_STEP_MIN} e ${CUSTOMER_SLOT_STEP_MAX} minutos.`}
          </p>
        )}
      </div>

      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Salvo! O cliente já vê os novos horários.</p>}
      <SubmitButton pendingText="Salvando...">Salvar</SubmitButton>
    </form>
  );
}
