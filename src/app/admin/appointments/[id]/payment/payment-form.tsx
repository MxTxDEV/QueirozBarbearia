"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-helpers";
import { registerPaymentAction } from "@/actions/financial";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";

export type ExtraServiceOption = { id: string; name: string; price: number };

type ExtraRow = { key: number; serviceId: string; price: string };

const toCents = (value: number) => Math.round(value * 100);

export function PaymentForm({
  appointmentId,
  defaultAmount,
  services,
}: {
  appointmentId: string;
  defaultAmount: number;
  services: ExtraServiceOption[];
}) {
  const action = registerPaymentAction.bind(null, appointmentId);
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [amount, setAmount] = useState(String(defaultAmount));

  const validRows = rows.filter((row) => row.serviceId && row.price !== "" && Number(row.price) >= 0);
  const extrasTotal = validRows.reduce((sum, row) => sum + Number(row.price), 0);

  // O valor recebido acompanha "agendamento + extras", mas continua editável (desconto, gorjeta...).
  function syncAmount(nextRows: ExtraRow[]) {
    const extras = nextRows
      .filter((row) => row.serviceId && row.price !== "" && Number(row.price) >= 0)
      .reduce((sum, row) => sum + Number(row.price), 0);
    setAmount(String((toCents(defaultAmount) + toCents(extras)) / 100));
  }

  function updateRows(nextRows: ExtraRow[]) {
    setRows(nextRows);
    syncAmount(nextRows);
  }

  function addRow() {
    updateRows([...rows, { key: nextKey, serviceId: "", price: "" }]);
    setNextKey(nextKey + 1);
  }

  function changeService(key: number, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    updateRows(rows.map((row) => (row.key === key ? { ...row, serviceId, price: service ? String(service.price) : "" } : row)));
  }

  function changePrice(key: number, price: string) {
    updateRows(rows.map((row) => (row.key === key ? { ...row, price } : row)));
  }

  function removeRow(key: number) {
    updateRows(rows.filter((row) => row.key !== key));
  }

  const extrasPayload = JSON.stringify(validRows.map((row) => ({ serviceId: row.serviceId, price: Number(row.price) })));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="extras" value={extrasPayload} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Serviços adicionais</Label>
          <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={services.length === 0 || rows.length >= 10}>
            <Plus className="h-4 w-4" /> Adicionar serviço
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-foreground-muted">
            O cliente fez mais alguma coisa na hora (ex: barba)? Adicione aqui com o valor cobrado.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <Select
                  aria-label="Serviço adicional"
                  value={row.serviceId}
                  onChange={(event) => changeService(row.key, event.target.value)}
                  className="flex-1"
                >
                  <option value="">Selecione o serviço…</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label="Valor do serviço adicional (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="R$"
                  value={row.price}
                  onChange={(event) => changePrice(row.key, event.target.value)}
                  className="w-28"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  aria-label="Remover serviço adicional"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-foreground-muted">
              Agendamento {formatCurrency(defaultAmount)} + adicionais {formatCurrency(extrasTotal)} ={" "}
              <span className="font-medium text-foreground">{formatCurrency(defaultAmount + extrasTotal)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Valor recebido (R$) *</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paymentMethod">Método de pagamento *</Label>
        <Select id="paymentMethod" name="paymentMethod" required defaultValue="PIX">
          {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paidAt">Data do pagamento *</Label>
        <Input id="paidAt" name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton pendingText="Registrando...">Confirmar pagamento</SubmitButton>
    </form>
  );
}
