"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createBarberIncomeAction, deleteIncomeAction, updateIncomeAction } from "@/actions/financial-transactions";
import { INCOME_CATEGORIES, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt } from "lucide-react";

export type IncomeRow = {
  id: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: string | null;
  /** YYYY-MM-DD */
  date: string;
  origin: "appointment" | "sale" | "manual";
  barberId: string | null;
  customerName: string | null;
};

export type BarberOption = { id: string; name: string };

const ORIGIN_LABEL: Record<IncomeRow["origin"], string> = { appointment: "Atendimento", sale: "PDV", manual: "Manual" };
const ORIGIN_HINT: Record<IncomeRow["origin"], string> = {
  appointment: "Veio do pagamento de um atendimento",
  sale: "Veio de uma venda no PDV",
  manual: "Lançada à mão",
};

const brDate = (iso: string) => iso.split("-").reverse().join("/");
const todayIso = () => new Date().toISOString().slice(0, 10);

function categoryOptions(extra: string[]) {
  return [...new Set([...INCOME_CATEGORIES, "PDV", ...extra])];
}

/** Baixa a lista (já filtrada) como planilha CSV — abre direto no Excel/Google Planilhas em português. */
function downloadCsv(rows: IncomeRow[], fileName: string) {
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [
    ["Data", "Descrição", "Cliente", "Categoria", "Origem", "Pagamento", "Valor"].map(cell).join(";"),
    ...rows.map((r) =>
      [
        brDate(r.date),
        r.description,
        r.customerName ?? "",
        r.category,
        ORIGIN_LABEL[r.origin],
        r.paymentMethod ? (PAYMENT_METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) : "",
        r.amount.toFixed(2).replace(".", ","),
      ]
        .map(cell)
        .join(";")
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a); // alguns navegadores só respeitam o nome do arquivo com o link no documento
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Campos comuns de lançar/editar uma receita. */
function IncomeFields({
  values,
  onChange,
  barbers,
  categories,
  allowNoBarber,
}: {
  values: { description: string; category: string; amount: string; paymentMethod: string; date: string; barberId: string };
  onChange: (patch: Partial<{ description: string; category: string; amount: string; paymentMethod: string; date: string; barberId: string }>) => void;
  barbers: BarberOption[];
  categories: string[];
  allowNoBarber: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inc-amount">Valor (R$) *</Label>
          <Input id="inc-amount" type="number" step="0.01" min="0.01" inputMode="decimal" value={values.amount} onChange={(e) => onChange({ amount: e.target.value })} required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-date">Data *</Label>
          <Input id="inc-date" type="date" value={values.date} onChange={(e) => onChange({ date: e.target.value })} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc-desc">Descrição *</Label>
        <Input id="inc-desc" value={values.description} onChange={(e) => onChange({ description: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inc-cat">Categoria *</Label>
          <Select id="inc-cat" value={values.category} onChange={(e) => onChange({ category: e.target.value })}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inc-method">Pagamento *</Label>
          <Select id="inc-method" value={values.paymentMethod} onChange={(e) => onChange({ paymentMethod: e.target.value })}>
            {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc-barber">Barbeiro</Label>
        <Select id="inc-barber" value={values.barberId} onChange={(e) => onChange({ barberId: e.target.value })}>
          {allowNoBarber && <option value="">Sem barbeiro</option>}
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

/** Botão "Lançar receita": registra uma receita direto no faturamento deste barbeiro. */
export function AddIncomeButton({ barberId, barberName, barbers }: { barberId: string; barberName: string; barbers: BarberOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const empty = { description: "", category: INCOME_CATEGORIES[0], amount: "", paymentMethod: "PIX", date: todayIso(), barberId };
  const [values, setValues] = useState(empty);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createBarberIncomeAction({ ...values, amount: values.amount });
      if (result.ok) {
        toast.success("Receita lançada.");
        setOpen(false);
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <>
      <Button
        onClick={() => {
          setValues({ ...empty, date: todayIso() });
          setError(null);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> Lançar receita
      </Button>
      {open && (
        <Modal title={`Lançar receita — ${barberName}`} icon={<Plus className="h-5 w-5 text-secondary-light" />} onClose={() => setOpen(false)} busy={pending}>
          <form onSubmit={submit} className="space-y-4">
            <IncomeFields
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              barbers={barbers}
              categories={categoryOptions([])}
              allowNoBarber={false}
            />
            {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Lançar receita"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function EditIncomeModal({ row, barbers, categories, onClose }: { row: IncomeRow; barbers: BarberOption[]; categories: string[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    description: row.description,
    category: row.category,
    amount: String(row.amount),
    paymentMethod: row.paymentMethod ?? "OTHER",
    date: row.date,
    barberId: row.barberId ?? "",
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateIncomeAction({ id: row.id, ...values });
      if (result.ok) {
        toast.success("Receita atualizada.");
        onClose();
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <Modal title="Editar receita" icon={<Pencil className="h-5 w-5 text-secondary-light" />} onClose={onClose} busy={pending}>
      <form onSubmit={submit} className="space-y-4">
        <IncomeFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} barbers={barbers} categories={categories} allowNoBarber />
        {row.origin !== "manual" && (
          <p className="text-xs text-foreground-muted">
            {row.origin === "sale"
              ? "Esta receita veio de uma venda no PDV: o total e a forma de pagamento da venda também são atualizados."
              : "Esta receita veio do pagamento de um atendimento: o pagamento registrado também é atualizado."}
          </p>
        )}
        {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteIncomeModal({ row, onClose }: { row: IncomeRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteIncomeAction(row.id);
      if (result.ok) {
        toast.success(result.data?.kind === "sale" ? "Venda cancelada e receita removida." : "Receita excluída.");
        onClose();
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <Modal title="Excluir receita?" icon={<Trash2 className="h-5 w-5 text-danger" />} onClose={onClose} busy={pending}>
      <p className="rounded-lg bg-[var(--surface-subtle)] p-3 text-sm text-foreground">
        <span className="font-medium">{row.description}</span>
        <span className="block text-xs text-foreground-muted">
          {brDate(row.date)} · {formatCurrency(row.amount)}
        </span>
      </p>
      <p className="text-sm text-foreground-muted">
        {row.origin === "sale"
          ? "A venda do PDV será cancelada (continua no histórico do caixa como cancelada) e o valor sai do faturamento."
          : row.origin === "appointment"
            ? "O pagamento será removido do faturamento e o atendimento volta a aparecer como sem pagamento, pronto para registrar de novo."
            : "A receita será removida do faturamento."}{" "}
        Essa ação não pode ser desfeita.
      </p>
      {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={confirm} disabled={pending}>
          {pending ? "Excluindo..." : "Excluir"}
        </Button>
      </div>
    </Modal>
  );
}

/** Lista de receitas do barbeiro: busca, filtros, exportar e editar/excluir cada linha. */
export function IncomeTable({
  rows,
  totalCount,
  barbers,
  barberName,
}: {
  rows: IncomeRow[];
  totalCount: number;
  barbers: BarberOption[];
  barberName: string;
}) {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("");
  const [origin, setOrigin] = useState("");
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [deleting, setDeleting] = useState<IncomeRow | null>(null);

  const categories = useMemo(() => categoryOptions(rows.map((r) => r.category)), [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q || `${r.description} ${r.customerName ?? ""} ${r.category}`.toLowerCase().includes(q)) &&
        (!method || (r.paymentMethod ?? "OTHER") === method) &&
        (!origin || r.origin === origin)
    );
  }, [rows, query, method, origin]);
  const filteredTotal = filtered.reduce((sum, r) => sum + r.amount, 0);
  const filtering = Boolean(query || method || origin);

  return (
    <Card variant="solid">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 z-10 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por cliente, descrição ou categoria…" className="pl-9" aria-label="Buscar receitas" />
        </div>
        <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-auto" aria-label="Filtrar por pagamento">
          <option value="">Todos os pagamentos</option>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-auto" aria-label="Filtrar por origem">
          <option value="">Todas as origens</option>
          <option value="appointment">Atendimentos</option>
          <option value="sale">PDV</option>
          <option value="manual">Manuais</option>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={filtered.length === 0}
          onClick={() => downloadCsv(filtered, `faturamento-${barberName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${todayIso()}.csv`)}
        >
          <Download className="h-4 w-4" /> Exportar planilha
        </Button>
      </div>

      <p className="px-4 pt-3 text-xs text-foreground-muted">
        {filtering ? (
          <>
            {filtered.length} de {rows.length} lançamentos · soma <span className="font-medium text-foreground">{formatCurrency(filteredTotal)}</span>
          </>
        ) : (
          <>{rows.length} lançamento(s)</>
        )}
        {totalCount > rows.length && ` (os ${rows.length} mais recentes de ${totalCount} no período — os totais acima consideram todos)`}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-foreground-muted">{brDate(r.date)}</TableCell>
              <TableCell className="text-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{r.description}</span>
                  <span title={ORIGIN_HINT[r.origin]}>
                    <Badge variant={r.origin === "manual" ? "muted" : r.origin === "sale" ? "accent" : "success"}>{ORIGIN_LABEL[r.origin]}</Badge>
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-foreground-muted">{r.category}</TableCell>
              <TableCell className="text-foreground-muted">{r.paymentMethod ? (PAYMENT_METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod) : "—"}</TableCell>
              <TableCell className="whitespace-nowrap font-medium text-success">+{formatCurrency(r.amount)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(r)}
                    aria-label={`Editar ${r.description}`}
                    title="Editar valor, data, pagamento, barbeiro…"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-[var(--surface-subtle-hover)] hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(r)}
                    aria-label={`Excluir ${r.description}`}
                    title="Excluir"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState
                  icon={Receipt}
                  title={filtering ? "Nada encontrado com esses filtros" : "Nenhum faturamento neste período"}
                  description={
                    filtering
                      ? "Limpe a busca ou os filtros para ver todos os lançamentos."
                      : `Os atendimentos pagos e as vendas no PDV de ${barberName} aparecem aqui automaticamente — ou use "Lançar receita".`
                  }
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {editing && <EditIncomeModal row={editing} barbers={barbers} categories={categories} onClose={() => setEditing(null)} />}
      {deleting && <DeleteIncomeModal row={deleting} onClose={() => setDeleting(null)} />}
    </Card>
  );
}
