"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createAutomationAction,
  deleteAutomationAction,
  saveAutomationAction,
  sendTestAutomationAction,
} from "@/actions/whatsapp-automations";
import {
  AUDIENCES,
  AUDIENCE_LABEL,
  AUTOMATION_KINDS,
  GROUP_LABEL,
  KIND_DEFS,
  MAX_TEMPLATE_LENGTH,
  describeOffset,
  renderTemplate,
  sampleVars,
  templateFields,
  type Audience,
  type AutomationKind,
} from "@/lib/whatsapp/automation-defs";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type RuleDto = {
  id: string;
  kind: AutomationKind;
  name: string;
  enabled: boolean;
  /** null = usa o texto padrão do sistema. */
  template: string | null;
  audience: Audience;
  offsetMinutes: number | null;
  sendTime: string | null;
  dayOfMonth: number | null;
  /** Muda a cada salvamento — reinicia os rascunhos da tela. */
  version: string;
};

const OFFSET_PRESETS = [
  { label: "1 dia antes", minutes: 1440 },
  { label: "3 horas antes", minutes: 180 },
  { label: "2 horas antes", minutes: 120 },
  { label: "1 hora antes", minutes: 60 },
  { label: "30 min antes", minutes: 30 },
];

function timingSummary(rule: RuleDto): string | null {
  const timing = KIND_DEFS[rule.kind].timing;
  if (timing === "before" && rule.offsetMinutes) return describeOffset(rule.offsetMinutes);
  if (timing === "morning" && rule.sendTime) return `no dia, a partir das ${rule.sendTime}`;
  if (timing === "monthly" && rule.sendTime) return `todo dia ${rule.dayOfMonth ?? 1} do mês, a partir das ${rule.sendTime}`;
  return null;
}

/** Tela "Mensagens automáticas": o que é enviado, para quem, quando e com qual texto. */
export function AutomationsEditor({ rules, companyName }: { rules: RuleDto[]; companyName: string }) {
  const groups = useMemo(() => {
    const order = Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[];
    return order
      .map((group) => ({ group, kinds: AUTOMATION_KINDS.filter((kind) => KIND_DEFS[kind].group === group) }))
      .filter((entry) => entry.kinds.length > 0);
  }, []);

  return (
    <div className="space-y-8">
      <Card className="space-y-2 p-5 text-sm text-foreground-muted">
        <p className="font-medium text-foreground">Como funciona</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Cada mensagem pode ser <strong className="text-foreground">ligada ou desligada</strong>, ter o <strong className="text-foreground">texto que você quiser</strong> e
            sair <strong className="text-foreground">só para um tipo de cliente</strong> (recorrentes, novos, quem já foi atendido…).
          </li>
          <li>
            Nos lembretes você escolhe <strong className="text-foreground">quanto tempo antes</strong> (1 dia, 2 horas, 1 hora…) e pode ter quantos quiser.
          </li>
          <li>
            Use os campos entre chaves, como <code className="rounded bg-[var(--surface-subtle)] px-1">{"{nome}"}</code> e{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1">{"{hora}"}</code> — o sistema troca pelos dados de cada cliente. Horários no fuso de Brasília.
          </li>
          <li>
            <strong className="text-foreground">Confirmação pelo cliente:</strong> os lembretes “antes do horário” levam um link (campo{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1">{"{confirmacao}"}</code>) em que o cliente confirma ou avisa que não vai. Você vê quem
            confirmou na Agenda (✅). Os padrões são 1 dia e 2 horas antes — mude à vontade.
          </li>
          <li>Se mais de uma mensagem do mesmo tipo valer para o mesmo cliente, vale a de público mais específico (a “Todos os clientes” é a reserva).</li>
        </ul>
      </Card>

      {groups.map(({ group, kinds }) => (
        <section key={group} className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{GROUP_LABEL[group]}</h2>
          {kinds.map((kind) => (
            <KindBlock key={kind} kind={kind} rules={rules.filter((r) => r.kind === kind)} companyName={companyName} />
          ))}
        </section>
      ))}

      <Card className="space-y-1 p-5 text-sm text-foreground-muted">
        <p className="font-medium text-foreground">Mensagens do sistema (não editáveis)</p>
        <p>O código de acesso do cliente e os alertas internos para o número da barbearia seguem um texto fixo, por segurança.</p>
      </Card>
    </div>
  );
}

function KindBlock({ kind, rules, companyName }: { kind: AutomationKind; rules: RuleDto[]; companyName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const def = KIND_DEFS[kind];
  const isBefore = def.timing === "before";

  function add() {
    startTransition(async () => {
      const result = await createAutomationAction({ kind, copyFromId: isBefore ? undefined : rules[0]?.id });
      if (result.ok) {
        toast.success(isBefore ? "Lembrete criado — ajuste o horário e o texto abaixo." : "Variação criada — escolha para qual tipo de cliente ela vale.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-foreground">{def.label}</h3>
          <p className="text-xs text-foreground-muted">{def.when}</p>
        </div>
        <Button size="sm" variant="outline" onClick={add} disabled={pending}>
          <Plus className="h-4 w-4" /> {isBefore ? "Adicionar lembrete" : "Texto para outro tipo de cliente"}
        </Button>
      </div>
      {rules.length === 0 && isBefore && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-foreground-muted">
          Nenhum lembrete antes do horário. Clique em “Adicionar lembrete” para criar (ex: 1 dia antes, 2 horas antes).
        </p>
      )}
      {rules.map((rule) => (
        <RuleCard key={`${rule.id}:${rule.version}`} rule={rule} companyName={companyName} canDelete={isBefore || rules.length > 1} />
      ))}
    </div>
  );
}

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 disabled:opacity-50",
        checked ? "border-success bg-success/80" : "bg-[var(--surface-subtle)]"
      )}
    >
      <span className={cn("absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} style={{ height: 18, width: 18 }} />
    </button>
  );
}

function RuleCard({ rule, companyName, canDelete }: { rule: RuleDto; companyName: string; canDelete: boolean }) {
  const router = useRouter();
  const def = KIND_DEFS[rule.kind];
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState(rule.name);
  const [audience, setAudience] = useState<Audience>(rule.audience);
  const [text, setText] = useState(rule.template ?? def.defaultTemplate);
  const [offset, setOffset] = useState(rule.offsetMinutes ?? 120);
  const [sendTime, setSendTime] = useState(rule.sendTime ?? (def.timing === "morning" ? "07:00" : "09:00"));
  const [dayOfMonth, setDayOfMonth] = useState(rule.dayOfMonth ?? 1);
  const [testPhone, setTestPhone] = useState("");

  const isDefaultText = text.trim() === def.defaultTemplate.trim();
  const dirty =
    name !== rule.name ||
    audience !== rule.audience ||
    (rule.template ?? def.defaultTemplate).trim() !== text.trim() ||
    (def.timing === "before" && offset !== rule.offsetMinutes) ||
    ((def.timing === "morning" || def.timing === "monthly") && sendTime !== rule.sendTime) ||
    (def.timing === "monthly" && dayOfMonth !== rule.dayOfMonth);

  const allowed = new Set(def.variables.map((v) => v.key));
  const unknown = templateFields(text).filter((f) => !allowed.has(f));
  const preview = renderTemplate(text, { ...sampleVars(rule.kind), barbearia: companyName });

  const offsetUnit = offset % 1440 === 0 ? "d" : offset % 60 === 0 ? "h" : "m";
  const offsetValue = offsetUnit === "d" ? offset / 1440 : offsetUnit === "h" ? offset / 60 : offset;

  function payload(overrides: Partial<{ enabled: boolean }> = {}, persistedOnly = false) {
    const base = persistedOnly
      ? { name: rule.name, audience: rule.audience, template: rule.template, offsetMinutes: rule.offsetMinutes, sendTime: rule.sendTime, dayOfMonth: rule.dayOfMonth }
      : {
          name,
          audience,
          template: isDefaultText ? null : text.trim(),
          offsetMinutes: def.timing === "before" ? offset : null,
          sendTime: def.timing === "morning" || def.timing === "monthly" ? sendTime : null,
          dayOfMonth: def.timing === "monthly" ? dayOfMonth : null,
        };
    return { id: rule.id, enabled: rule.enabled, ...base, ...overrides };
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        onOk?.();
        router.refresh();
      } else {
        setError(result.error ?? "Não foi possível concluir.");
        toast.error(result.error ?? "Não foi possível concluir.");
      }
    });
  }

  function insertField(key: string) {
    const area = textRef.current;
    const token = `{${key}}`;
    if (!area) return setText((t) => `${t}${token}`);
    const start = area.selectionStart ?? text.length;
    const end = area.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${token}${text.slice(end)}`;
    setText(next);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function setOffsetFrom(value: number, unit: string) {
    const factor = unit === "d" ? 1440 : unit === "h" ? 60 : 1;
    setOffset(Math.max(0, Math.round(value * factor)));
  }

  const summary = timingSummary({ ...rule, offsetMinutes: def.timing === "before" ? offset : rule.offsetMinutes, sendTime: rule.sendTime });

  return (
    <Card variant="solid" className={cn("overflow-hidden", !rule.enabled && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <Switch
          checked={rule.enabled}
          disabled={pending}
          label={rule.enabled ? "Desligar esta mensagem" : "Ligar esta mensagem"}
          onChange={(value) => run(() => saveAutomationAction(payload({ enabled: value }, true)), value ? "Mensagem ligada." : "Mensagem desligada.")}
        />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-foreground">{rule.name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={rule.enabled ? "success" : "muted"}>{rule.enabled ? "Ligada" : "Desligada"}</Badge>
              <Badge variant="muted">{AUDIENCE_LABEL[rule.audience]}</Badge>
              {summary && <Badge variant="accent">{summary}</Badge>}
              {rule.template !== null && <Badge variant="warning">Texto personalizado</Badge>}
              {(rule.template ?? def.defaultTemplate).match(/\{(confirmacao|link)\}/) && <Badge variant="success">Com link de confirmação</Badge>}
            </span>
          </span>
          <span className="text-xs text-secondary-light">{open ? "Fechar" : "Editar"}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-foreground-muted transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`name-${rule.id}`}>Nome (só para você se organizar)</Label>
              <Input id={`name-${rule.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`aud-${rule.id}`}>Para qual tipo de cliente</Label>
              <Select id={`aud-${rule.id}`} value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABEL[a]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {def.timing === "before" && (
            <div className="space-y-2">
              <Label>Quanto tempo antes do horário</Label>
              <div className="flex flex-wrap gap-2">
                {OFFSET_PRESETS.map((p) => (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => setOffset(p.minutes)}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-sm",
                      offset === p.minutes ? "border-secondary bg-secondary/20 text-foreground" : "text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-muted">ou outro tempo:</span>
                <Input
                  type="number"
                  min={1}
                  value={offsetValue}
                  onChange={(e) => setOffsetFrom(Number(e.target.value), offsetUnit)}
                  className="w-24"
                  aria-label="Quantidade de tempo antes do horário"
                />
                <Select value={offsetUnit} onChange={(e) => setOffsetFrom(offsetValue, e.target.value)} className="w-auto" aria-label="Unidade de tempo">
                  <option value="m">minutos</option>
                  <option value="h">horas</option>
                  <option value="d">dias</option>
                </Select>
                <span className="text-sm text-foreground-muted">antes</span>
              </div>
              <p className="text-xs text-foreground-muted">
                Não é enviado se o horário foi marcado já dentro desse prazo (o cliente acabou de saber), e deixa de valer quando já passou da metade do caminho.
              </p>
            </div>
          )}

          {def.timing === "morning" && (
            <div className="space-y-1.5">
              <Label htmlFor={`time-${rule.id}`}>A partir de que horas, no dia do horário</Label>
              <Input id={`time-${rule.id}`} type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="w-40" />
              <p className="text-xs text-foreground-muted">Sai uma mensagem por cliente com todos os horários dele no dia. Não sai se o horário é em menos de 30 minutos.</p>
            </div>
          )}

          {def.timing === "monthly" && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`dom-${rule.id}`}>Dia do mês</Label>
                <Input id={`dom-${rule.id}`} type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} className="w-24" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`mtime-${rule.id}`}>A partir de que horas</Label>
                <Input id={`mtime-${rule.id}`} type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="w-40" />
              </div>
              <p className="max-w-sm text-xs text-foreground-muted">
                Cada cliente recebe uma vez por mês, com os horários dele daquele dia até o fim do mês. Se o sistema ficar fora do ar, ainda envia nos 2 dias seguintes.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={`text-${rule.id}`}>Mensagem</Label>
              <span className={cn("text-xs", text.length > MAX_TEMPLATE_LENGTH ? "text-danger" : "text-foreground-muted")}>
                {text.length}/{MAX_TEMPLATE_LENGTH}
              </span>
            </div>
            <Textarea id={`text-${rule.id}`} ref={textRef} value={text} onChange={(e) => setText(e.target.value)} rows={10} className="font-mono text-[13px]" />
            <div>
              <p className="mb-1.5 text-xs text-foreground-muted">Clique para inserir um campo na mensagem:</p>
              <div className="flex flex-wrap gap-1.5">
                {def.variables.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertField(v.key)}
                    title={`${v.label} — exemplo: ${v.example || "(vazio)"}`}
                    className="rounded-lg border bg-[var(--surface-subtle)] px-2 py-1 text-xs text-foreground hover:bg-[var(--surface-subtle-hover)]"
                  >
                    {`{${v.key}}`}
                    <span className="ml-1 text-foreground-muted">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {unknown.length > 0 && (
              <p className="text-xs text-danger">Campo(s) que não existem nesta mensagem: {unknown.map((u) => `{${u}}`).join(", ")}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Como o cliente vai ver (dados de exemplo)</p>
            <div className="max-w-md rounded-2xl rounded-tl-sm bg-[#d9fdd3] px-3 py-2 text-sm leading-relaxed text-[#111b21] shadow">
              <p className="whitespace-pre-wrap break-words">{preview || "—"}</p>
            </div>
          </div>

          {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              onClick={() => run(() => saveAutomationAction(payload()), "Mensagem salva.")}
              disabled={pending || !dirty || unknown.length > 0 || text.length > MAX_TEMPLATE_LENGTH}
            >
              {pending ? "Salvando..." : dirty ? "Salvar alterações" : "Salvo"}
            </Button>
            <Button variant="outline" onClick={() => setText(def.defaultTemplate)} disabled={pending || isDefaultText}>
              <RotateCcw className="h-4 w-4" /> Restaurar texto padrão
            </Button>
            <Button
              variant="outline"
              onClick={() => run(() => createAutomationAction({ kind: rule.kind, copyFromId: rule.id }), "Cópia criada.")}
              disabled={pending}
            >
              <Copy className="h-4 w-4" /> Duplicar
            </Button>
            {canDelete && (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending} className="text-danger">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
            <Send className="h-4 w-4 text-secondary-light" />
            <span className="text-sm text-foreground-muted">Enviar um teste para:</span>
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="(31) 99999-9999" className="w-44" aria-label="WhatsApp para receber o teste" />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || unknown.length > 0 || testPhone.trim().length < 8}
              onClick={() => run(() => sendTestAutomationAction({ kind: rule.kind, template: text, phone: testPhone }), "Teste enviado — confira o WhatsApp.")}
            >
              Enviar teste
            </Button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <Modal title="Excluir esta mensagem?" icon={<Trash2 className="h-5 w-5 text-danger" />} onClose={() => setConfirmDelete(false)} busy={pending}>
          <p className="text-sm text-foreground-muted">
            “{rule.name}” deixa de ser enviada. Se só quer parar de enviar por um tempo, prefira <strong className="text-foreground">desligar</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => deleteAutomationAction(rule.id), "Mensagem excluída.", () => setConfirmDelete(false))}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
