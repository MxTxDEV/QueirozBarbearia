/**
 * Catálogo das mensagens automáticas de WhatsApp — parte PURA (sem banco), testável e usada
 * tanto pelos envios quanto pela tela "WhatsApp > Mensagens automáticas".
 *
 * Cada tipo (kind) tem: um nome, os campos que o texto pode usar (`{nome}`, `{data}`…), o texto
 * padrão e, nos agendados, que tipo de horário se configura. O texto da empresa (editado na tela)
 * sobrescreve o padrão; campo desconhecido é recusado ao salvar.
 */

export const AUTOMATION_KINDS = [
  "REMINDER_BEFORE",
  "REMINDER_MORNING",
  "MONTHLY_SUMMARY",
  "BOOKED_BY_SHOP",
  "RECURRING_BOOKED_BY_SHOP",
  "CONFIRMATION",
  "CANCELLATION",
  "THANKS",
  "WAITLIST_OFFER",
  "RECURRING_APPROVED",
  "RECURRING_REJECTED",
] as const;
export type AutomationKind = (typeof AUTOMATION_KINDS)[number];

export const AUDIENCES = ["ALL", "RECURRING", "NON_RECURRING", "NEW", "RETURNING"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: "Todos os clientes",
  RECURRING: "Clientes com recorrência",
  NON_RECURRING: "Clientes sem recorrência",
  NEW: "Clientes novos (ainda sem atendimento concluído)",
  RETURNING: "Clientes que já foram atendidos",
};

export type TemplateVariable = { key: string; label: string; example: string };

export type KindDef = {
  label: string;
  /** Quando esta mensagem é enviada, em uma frase. */
  when: string;
  group: "reminders" | "monthly" | "booking" | "after" | "special";
  /** Que horário se configura: "before" (X antes), "morning" (a partir de HH:MM do dia), "monthly" (dia do mês + HH:MM). */
  timing?: "before" | "morning" | "monthly";
  variables: TemplateVariable[];
  defaultTemplate: string;
};

const NOME: TemplateVariable = { key: "nome", label: "Nome do cliente", example: "João" };
const BARBEARIA: TemplateVariable = { key: "barbearia", label: "Nome da barbearia", example: "Queiroz Barbearia" };
const DATA: TemplateVariable = { key: "data", label: "Data do horário", example: "09/10/2026" };
const HORA: TemplateVariable = { key: "hora", label: "Hora do horário", example: "15:00" };
const BARBEIRO: TemplateVariable = { key: "barbeiro", label: "Barbeiro", example: "Marcos" };
const SERVICOS: TemplateVariable = { key: "servicos", label: "Serviços (lista)", example: "• Corte Social\n• Barba" };
const TOTAL: TemplateVariable = { key: "total", label: "Valor total (sem R$)", example: "80,00" };
const SERVICO: TemplateVariable = { key: "servico", label: "Serviço", example: "Corte Social" };
const LINK: TemplateVariable = {
  key: "link",
  label: "Link para o cliente confirmar o horário (só o endereço)",
  example: "https://seusite.com/confirmar/abc123xyz",
};
const CONFIRMACAO: TemplateVariable = {
  key: "confirmacao",
  label: "Frase + link para confirmar o horário (some se não houver link)",
  example: "✅ Confirme seu horário com um toque:\nhttps://seusite.com/confirmar/abc123xyz",
};
const FREQUENCIA: TemplateVariable = { key: "frequencia", label: "Frequência da recorrência", example: "Toda semana" };

export const KIND_DEFS: Record<AutomationKind, KindDef> = {
  REMINDER_BEFORE: {
    label: "Lembrete antes do horário",
    when: "Um tempo antes do horário marcado (você escolhe: 1 dia, 2 horas, 1 hora…). Pode ter vários.",
    group: "reminders",
    timing: "before",
    variables: [
      NOME, BARBEARIA, DATA, HORA, BARBEIRO, SERVICOS, TOTAL, LINK, CONFIRMACAO,
      { key: "quando", label: "“hoje”, “amanhã” ou “no dia 09/10/2026”", example: "amanhã" },
    ],
    defaultTemplate: `Olá, {nome}! 💈

Passando para lembrar que você possui um horário agendado {quando}:

📅 {data}
⏰ {hora}
✂️ Barbeiro: {barbeiro}

{confirmacao}

Nos vemos em breve!`,
  },
  REMINDER_MORNING: {
    label: "Lembrete “é hoje” (manhã do dia)",
    when: "No dia do horário, a partir da hora que você definir (ex: 7h). Uma mensagem por cliente, com todos os horários dele no dia.",
    group: "reminders",
    timing: "morning",
    variables: [
      NOME, BARBEARIA,
      { key: "chamada", label: "“Você tem um horário marcado hoje” (ajusta para vários)", example: "Você tem um horário marcado hoje" },
      { key: "horarios", label: "Lista dos horários do dia", example: "⏰ 15:00 — Corte Social com Marcos" },
      {
        key: "confirmacoes",
        label: "Link para confirmar o horário (um por horário; some se não houver link)",
        example: "✅ Confirme seu horário com um toque:\nhttps://seusite.com/confirmar/abc123xyz",
      },
    ],
    defaultTemplate: `Bom dia, {nome}! ☀️💈

{chamada} na {barbearia}:

{horarios}

{confirmacoes}

Te esperamos! Se não puder vir, avise a gente por aqui.`,
  },
  MONTHLY_SUMMARY: {
    label: "Resumo do mês",
    when: "Uma vez por mês, no dia que você escolher (ex: dia 1), com todos os horários do cliente no mês.",
    group: "monthly",
    timing: "monthly",
    variables: [
      NOME, BARBEARIA,
      { key: "mes", label: "Mês e ano", example: "Outubro de 2026" },
      { key: "horarios", label: "Lista de horários do mês (recorrência e avulsos)", example: "• sex, 09/10 às 15:00" },
    ],
    defaultTemplate: `Olá, {nome}! 💈

Estes são os seus horários marcados em {mes} na {barbearia}:

{horarios}

Um dia antes de cada horário, avisamos você de novo por aqui. Se precisar mudar alguma data, é só nos chamar!`,
  },
  BOOKED_BY_SHOP: {
    label: "Barbearia marcou um horário para o cliente",
    when: "Na hora em que o barbeiro/recepção marca um horário avulso para o cliente.",
    group: "booking",
    variables: [NOME, BARBEARIA, DATA, HORA, BARBEIRO, SERVICOS, TOTAL, LINK, CONFIRMACAO],
    defaultTemplate: `Olá, {nome}! 💈

A {barbearia} acabou de agendar um horário para você:

📅 Data: {data}
⏰ Horário: {hora}
✂️ Barbeiro: {barbeiro}

Serviços:
{servicos}

💰 Total: R$ {total}

{confirmacao}

Se precisar mudar, é só nos avisar por aqui. Até lá!`,
  },
  RECURRING_BOOKED_BY_SHOP: {
    label: "Barbearia marcou horário + recorrência",
    when: "Na hora em que o barbeiro/recepção marca o horário e a recorrência do cliente de uma vez.",
    group: "booking",
    variables: [
      NOME, BARBEARIA, SERVICO, BARBEIRO, FREQUENCIA,
      { key: "datas", label: "Lista das datas marcadas", example: "• qua, 07/10 às 15:00\n• qua, 14/10 às 15:00" },
      { key: "observacao", label: "Aviso de datas sem vaga (vazio se não houver)", example: "" },
    ],
    defaultTemplate: `Olá, {nome}! 💈

A {barbearia} acabou de agendar seu horário e a sua recorrência:

✂️ {servico} com {barbeiro}
🔁 {frequencia}

Datas marcadas:
{datas}

{observacao}

Todo dia 1º do mês e um dia antes de cada horário, avisamos você por aqui. Se precisar mudar alguma data, é só nos chamar!`,
  },
  CONFIRMATION: {
    label: "Horário confirmado",
    when: "Quando a barbearia confirma o agendamento do cliente.",
    group: "booking",
    variables: [NOME, BARBEARIA, DATA, HORA, BARBEIRO, SERVICOS, TOTAL],
    defaultTemplate: `Olá, {nome}! 💈

Seu horário foi confirmado.

📅 Data: {data}
⏰ Horário: {hora}
✂️ Barbeiro: {barbeiro}

Serviços:
{servicos}

💰 Total: R$ {total}

Aguardamos você!`,
  },
  CANCELLATION: {
    label: "Horário cancelado",
    when: "Quando um agendamento é cancelado.",
    group: "booking",
    variables: [NOME, BARBEARIA, DATA, HORA],
    defaultTemplate: `Olá, {nome}.

Seu agendamento do dia {data}, às {hora}, foi cancelado.

Caso queira, você pode realizar um novo agendamento pelo aplicativo.`,
  },
  THANKS: {
    label: "Agradecimento + avaliação",
    when: "Depois do atendimento concluído e pago.",
    group: "after",
    variables: [
      NOME, BARBEARIA,
      { key: "avaliacao", label: "Pedido de avaliação (com o link, se a barbearia tiver um)", example: "Podemos contar com sua avaliação? https://…" },
    ],
    defaultTemplate: `Olá, {nome}! 💈

Muito obrigado pela preferência! Foi um prazer atender você na {barbearia}.

{avaliacao}

Esperamos você na próxima! 🙌`,
  },
  WAITLIST_OFFER: {
    label: "Vaga da lista de espera",
    when: "Quando abre uma vaga para quem está na lista de espera.",
    group: "special",
    variables: [
      NOME, BARBEARIA, SERVICO, BARBEIRO, DATA, HORA,
      { key: "prazo", label: "Hora limite para confirmar", example: "14:30" },
    ],
    defaultTemplate: `Olá, {nome}! 💈

Horário disponível para você!

✂️ {servico}

💈 Barbeiro: {barbeiro}

📅 Data: {data}

⏰ Horário: {hora}

Você tem até {prazo} para confirmar, senão a vaga passa para o próximo da lista de espera.`,
  },
  RECURRING_APPROVED: {
    label: "Recorrência aprovada",
    when: "Quando a barbearia aprova a recorrência pedida pelo cliente.",
    group: "special",
    variables: [
      NOME, BARBEARIA, SERVICO, BARBEIRO, FREQUENCIA,
      { key: "reservados", label: "Quantos horários foram reservados", example: "8" },
      { key: "observacao", label: "Aviso de datas sem vaga (vazio se não houver)", example: "" },
    ],
    defaultTemplate: `Olá, {nome}! 💈

Sua recorrência foi confirmada!

✂️ {servico}

💈 Barbeiro: {barbeiro}

🔁 {frequencia}

{reservados} horário(s) já reservados na sua agenda.

{observacao}`,
  },
  RECURRING_REJECTED: {
    label: "Recorrência recusada",
    when: "Quando a barbearia recusa a recorrência pedida pelo cliente.",
    group: "special",
    variables: [
      NOME, BARBEARIA, SERVICO,
      { key: "motivo", label: "Motivo (vazio se não informado)", example: "Barbeiro sem agenda nesse horário" },
    ],
    defaultTemplate: `Olá, {nome}.

Sua solicitação de recorrência para {servico} não pôde ser confirmada pelo barbeiro.

{motivo}

Você pode agendar normalmente ou solicitar uma nova recorrência.`,
  },
};

/** Disponível em TODAS as mensagens: o link de divulgação da barbearia (onde o cliente agenda). */
export const BOOKING_LINK_VARIABLE: TemplateVariable = {
  key: "link_agendamento",
  label: "Link para o cliente agendar (divulgação da barbearia)",
  example: "https://suabarbearia.com.br/agendar/sua-barbearia",
};
for (const def of Object.values(KIND_DEFS)) def.variables.push(BOOKING_LINK_VARIABLE);

/** Texto do rodapé anexado ao fim de toda mensagem (a menos que a mensagem já use {link_agendamento} no meio). */
export const DEFAULT_FOOTER_TEXT = "📲 Agende seu horário: {link_agendamento}";

/**
 * Anexa o rodapé com o link de agendamento. Não anexa se: o rodapé está desligado, a barbearia não tem
 * link, ou o próprio texto da mensagem já usa o link (evita repetir).
 */
export function applyFooter(
  message: string,
  options: { enabled: boolean; text: string; link: string | null; templateUsesLink: boolean }
): string {
  if (!options.enabled || !options.link || options.templateUsesLink) return message;
  const footer = renderTemplate(options.text, { link_agendamento: options.link });
  return footer ? `${message}\n\n${footer}` : message;
}

export const GROUP_LABEL: Record<KindDef["group"], string> = {
  reminders: "Lembretes de horário",
  monthly: "Resumo mensal",
  booking: "Quando marcar, confirmar ou cancelar",
  after: "Depois do atendimento",
  special: "Lista de espera e recorrência",
};

export const isAutomationKind = (value: string): value is AutomationKind => (AUTOMATION_KINDS as readonly string[]).includes(value);
export const isAudience = (value: string): value is Audience => (AUDIENCES as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export const MAX_TEMPLATE_LENGTH = 1500;

/**
 * Troca `{campo}` pelos valores. Campo sem valor vira vazio. No fim, arruma o que sobrou de campos
 * vazios (linhas em branco repetidas, espaços antes de pontuação) pra mensagem não ficar com buracos.
 */
export function renderTemplate(template: string, vars: Record<string, string | number | undefined>): string {
  const filled = template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
  return filled
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Campos `{x}` usados no texto. */
export function templateFields(template: string): string[] {
  return [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
}

/** Mensagem de erro (pt-BR) se o texto não pode ser salvo; null se está ok. */
export function validateTemplate(kind: AutomationKind, template: string): string | null {
  const text = template.trim();
  if (text.length === 0) return "Escreva a mensagem (ou use “Restaurar texto padrão”).";
  if (text.length > MAX_TEMPLATE_LENGTH) return `A mensagem passou de ${MAX_TEMPLATE_LENGTH} caracteres.`;
  const allowed = new Set(KIND_DEFS[kind].variables.map((v) => v.key));
  const unknown = templateFields(text).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    return `Campo(s) desconhecido(s) nesta mensagem: ${unknown.map((u) => `{${u}}`).join(", ")}. Use só: ${[...allowed].map((a) => `{${a}}`).join(", ")}.`;
  }
  return null;
}

/** Valores de exemplo, pra pré-visualizar e pra mensagem de teste. */
export function sampleVars(kind: AutomationKind): Record<string, string> {
  return Object.fromEntries(KIND_DEFS[kind].variables.map((v) => [v.key, v.example]));
}

// ---------------------------------------------------------------------------
// Horário das regras agendadas
// ---------------------------------------------------------------------------

export const MIN_OFFSET_MINUTES = 5;
export const MAX_OFFSET_MINUTES = 7 * 24 * 60;

/** "1 dia antes", "2 horas antes", "45 minutos antes". */
export function describeOffset(minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} ${days === 1 ? "dia" : "dias"} antes`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hora" : "horas"} antes`;
  }
  return `${minutes} minutos antes`;
}

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Regras padrão do sistema (o que existia antes da tela de edição)
// ---------------------------------------------------------------------------

export type DefaultRule = {
  key: string;
  kind: AutomationKind;
  name: string;
  offsetMinutes?: number;
  sendTime?: string;
  dayOfMonth?: number;
  sortOrder: number;
};

export const DEFAULT_RULES: DefaultRule[] = [
  { key: "REMINDER_BEFORE:1d", kind: "REMINDER_BEFORE", name: "Lembrete 1 dia antes", offsetMinutes: 1440, sortOrder: 0 },
  { key: "REMINDER_BEFORE:2h", kind: "REMINDER_BEFORE", name: "Lembrete 2 horas antes", offsetMinutes: 120, sortOrder: 1 },
  { key: "REMINDER_MORNING", kind: "REMINDER_MORNING", name: "Lembrete da manhã do dia", sendTime: "07:00", sortOrder: 0 },
  { key: "MONTHLY_SUMMARY", kind: "MONTHLY_SUMMARY", name: "Resumo do mês", dayOfMonth: 1, sendTime: "09:00", sortOrder: 0 },
  { key: "BOOKED_BY_SHOP", kind: "BOOKED_BY_SHOP", name: "Barbearia marcou um horário", sortOrder: 0 },
  { key: "RECURRING_BOOKED_BY_SHOP", kind: "RECURRING_BOOKED_BY_SHOP", name: "Barbearia marcou horário + recorrência", sortOrder: 0 },
  { key: "CONFIRMATION", kind: "CONFIRMATION", name: "Horário confirmado", sortOrder: 0 },
  { key: "CANCELLATION", kind: "CANCELLATION", name: "Horário cancelado", sortOrder: 0 },
  { key: "THANKS", kind: "THANKS", name: "Agradecimento + avaliação", sortOrder: 0 },
  { key: "WAITLIST_OFFER", kind: "WAITLIST_OFFER", name: "Vaga da lista de espera", sortOrder: 0 },
  { key: "RECURRING_APPROVED", kind: "RECURRING_APPROVED", name: "Recorrência aprovada", sortOrder: 0 },
  { key: "RECURRING_REJECTED", kind: "RECURRING_REJECTED", name: "Recorrência recusada", sortOrder: 0 },
];

// ---------------------------------------------------------------------------
// Escolha da regra para um cliente
// ---------------------------------------------------------------------------

export type CustomerSegments = { recurring: boolean; hasCompleted: boolean };

export function matchesAudience(audience: string, segments: CustomerSegments): boolean {
  switch (audience) {
    case "RECURRING":
      return segments.recurring;
    case "NON_RECURRING":
      return !segments.recurring;
    case "NEW":
      return !segments.hasCompleted;
    case "RETURNING":
      return segments.hasCompleted;
    default:
      return true; // ALL
  }
}

/**
 * Entre as regras LIGADAS de um tipo, a que vale para este cliente: a de público mais específico
 * ganha da "Todos os clientes". Empate: a primeira na ordem da tela.
 */
export function pickRule<T extends { enabled: boolean; audience: string; sortOrder: number }>(rules: T[], segments: CustomerSegments): T | null {
  const candidates = rules
    .filter((rule) => rule.enabled && matchesAudience(rule.audience, segments))
    .sort((a, b) => Number(a.audience === "ALL") - Number(b.audience === "ALL") || a.sortOrder - b.sortOrder);
  return candidates[0] ?? null;
}

/** "amanhã" / "hoje" / "no dia 09/10/2026" — `diffDays` = dias entre hoje e o dia do horário. */
export function whenLabel(diffDays: number, dateLabel: string): string {
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "amanhã";
  return `no dia ${dateLabel}`;
}
