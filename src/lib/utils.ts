import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function weekdayName(weekday: number) {
  return WEEKDAY_NAMES[weekday] ?? "";
}

/** Normaliza um número de telefone brasileiro para o formato internacional +55DDNNNNNNNNN. */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let national = digits;
  if (national.startsWith("55") && national.length > 11) {
    national = national.slice(2);
  }
  if (national.length !== 10 && national.length !== 11) return null;
  return `+55${national}`;
}

export function formatWhatsappDisplay(e164: string) {
  const digits = e164.replace(/\D/g, "").replace(/^55/, "");
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 9) {
    return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
}
