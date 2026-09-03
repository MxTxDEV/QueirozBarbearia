"use client";

import { useTheme } from "@/components/theme-provider";

/**
 * Recharts não lê custom properties CSS diretamente (SVG puro, sem
 * cascata) — os valores aqui espelham os tokens de src/app/globals.css
 * por tema. Se um token mudar lá, precisa espelhar aqui também.
 */
const DARK = {
  accent: "#38bdf8", // --secondary-light
  axis: "#9aa1ac", // --foreground-muted
  tooltipBg: "#101114", // --background-elevated
  tooltipBorder: "rgba(255,255,255,0.1)", // --border-glass
  tooltipText: "#f7f8fa", // --foreground
  cursor: "rgba(255,255,255,0.15)",
  categorical: ["#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#f472b6", "#fb923c"],
};

const LIGHT = {
  accent: "#0273ad", // --secondary-light
  axis: "#5b6472", // --foreground-muted
  tooltipBg: "#ffffff", // --background-elevated
  tooltipBorder: "rgba(15,23,42,0.12)", // --border-glass
  tooltipText: "#14161a", // --foreground
  cursor: "rgba(15,23,42,0.12)",
  // mesma família de cor do escuro, um degrau mais saturado/escuro pra não
  // lavar contra um card claro (mesmo motivo do ajuste em --secondary-light).
  categorical: ["#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#db2777", "#ea580c"],
};

export function useChartTheme() {
  const { theme } = useTheme();
  return theme === "light" ? LIGHT : DARK;
}
