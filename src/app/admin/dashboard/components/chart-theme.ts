"use client";

import { useTheme } from "@/components/theme-provider";

/**
 * Recharts não lê custom properties CSS diretamente (SVG puro, sem
 * cascata) — os valores aqui espelham os tokens de src/app/globals.css
 * por tema. Se um token mudar lá, precisa espelhar aqui também.
 */
const DARK = {
  accent: "#ff5a55", // --secondary-light
  axis: "#9ea4a4", // --foreground-muted
  tooltipBg: "#121515", // --background-elevated
  tooltipBorder: "rgba(245,245,245,0.09)", // --border-glass
  tooltipText: "#f5f5f5", // --foreground
  cursor: "rgba(245,245,245,0.14)",
  categorical: ["#ff5a55", "#f5b83d", "#60a5fa", "#a3a8a8", "#34d399", "#c084fc"],
};

const LIGHT = {
  accent: "#c8161d", // --secondary-light
  axis: "#596060", // --foreground-muted
  tooltipBg: "#ffffff", // --background-elevated
  tooltipBorder: "rgba(8,11,11,0.1)", // --border-glass
  tooltipText: "#080b0b", // --foreground
  cursor: "rgba(8,11,11,0.12)",
  // mesma família de cor do escuro, um degrau mais saturado/escuro pra não
  // lavar contra um card claro (mesmo motivo do ajuste em --secondary-light).
  categorical: ["#c8161d", "#b45309", "#2563eb", "#525858", "#047857", "#7c3aed"],
};

export function useChartTheme() {
  const { theme } = useTheme();
  return theme === "light" ? LIGHT : DARK;
}
