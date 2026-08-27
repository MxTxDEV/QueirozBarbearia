import type { BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

export const APPOINTMENT_STATUS_VARIANT: Record<string, Variant> = {
  PENDING: "warning",
  CONFIRMED: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "muted",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  OTHER: "Outro",
};

export const TRANSACTION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  OVERDUE: "Vencido",
};

export const TRANSACTION_STATUS_VARIANT: Record<string, Variant> = {
  PENDING: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

export const RECURRENCE_LABEL: Record<string, string> = {
  NONE: "Não recorrente",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

export const GOAL_TYPE_LABEL: Record<string, string> = {
  REVENUE: "Faturamento",
  APPOINTMENTS: "Atendimentos",
  BARBER_REVENUE: "Faturamento por barbeiro",
};

export const GOAL_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Em andamento",
  ACHIEVED: "Atingida",
  AT_RISK: "Em risco",
  EXPIRED: "Expirada",
};

export const GOAL_STATUS_VARIANT: Record<string, Variant> = {
  ACTIVE: "default",
  ACHIEVED: "success",
  AT_RISK: "danger",
  EXPIRED: "muted",
};

export const EXPENSE_CATEGORIES = [
  "Aluguel",
  "Água",
  "Energia",
  "Internet",
  "Produtos",
  "Equipamentos",
  "Marketing",
  "Salários",
  "Manutenção",
  "Impostos",
  "Outros",
];

export const INCOME_CATEGORIES = [
  "Serviços",
  "Produtos",
  "Comissões",
  "Outros",
];
