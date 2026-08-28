import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  Scissors,
  UserCog,
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
  FileBarChart,
  Bell,
  MessageCircle,
  Settings,
  Building2,
  ShieldCheck,
  UserCog2,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Só aparece pro ADMIN — login de barbeiro só vê as próprias métricas, nunca dados financeiros/de outro barbeiro. */
  adminOnly?: boolean;
};
export type NavSection = { title?: string; items: NavItem[] };

export const ADMIN_NAV_SECTIONS: NavSection[] = [
  { items: [{ label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard }] },
  {
    title: "Agenda",
    items: [
      { label: "Agendamentos", href: "/admin/appointments", icon: CalendarClock },
      { label: "Clientes", href: "/admin/customers", icon: Users },
      { label: "Barbeiros", href: "/admin/barbers", icon: UserCog },
      { label: "Serviços", href: "/admin/services", icon: Scissors },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { label: "Visão geral", href: "/admin/financial", icon: Wallet, adminOnly: true },
      { label: "Receitas", href: "/admin/financial/income", icon: TrendingUp, adminOnly: true },
      { label: "Despesas", href: "/admin/financial/expenses", icon: TrendingDown, adminOnly: true },
      { label: "Metas", href: "/admin/goals", icon: Target },
      { label: "Relatórios", href: "/admin/reports", icon: FileBarChart, adminOnly: true },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Usuários", href: "/admin/users", icon: UserCog2, adminOnly: true },
      { label: "Notificações", href: "/admin/notifications", icon: Bell },
      { label: "WhatsApp", href: "/admin/whatsapp", icon: MessageCircle },
      { label: "Configurações", href: "/admin/settings", icon: Settings },
    ],
  },
];

export const SUPERADMIN_NAV_SECTIONS: NavSection[] = [
  { items: [{ label: "Dashboard", href: "/superadmin/dashboard", icon: LayoutDashboard }] },
  {
    title: "Plataforma",
    items: [
      { label: "Empresas", href: "/superadmin/companies", icon: Building2 },
      { label: "Usuários", href: "/superadmin/users", icon: Users },
      { label: "Auditoria", href: "/superadmin/audit", icon: ShieldCheck },
    ],
  },
];
