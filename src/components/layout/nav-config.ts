import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  Scissors,
  UserCog,
  Wallet,
  Target,
  FileBarChart,
  Bell,
  MessageCircle,
  Settings,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };
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
      { label: "Visão geral", href: "/admin/financial", icon: Wallet },
      { label: "Metas", href: "/admin/goals", icon: Target },
      { label: "Relatórios", href: "/admin/reports", icon: FileBarChart },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Notificações", href: "/admin/notifications", icon: Bell },
      { label: "WhatsApp", href: "/admin/whatsapp", icon: MessageCircle },
      { label: "Configurações", href: "/admin/settings", icon: Settings },
    ],
  },
];
