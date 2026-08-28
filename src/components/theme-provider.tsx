"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Toaster } from "sonner";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: "dark",
  toggleTheme: () => {},
});

/**
 * Fonte única do tema atual. O padrão é sempre "dark" (a identidade visual
 * do produto) — "light" só existe como escolha explícita do usuário,
 * persistida em localStorage e aplicada via [data-theme="light"] no
 * <html> (ver globals.css). O <html> já chega com o atributo certo antes
 * do primeiro paint graças ao script inline em layout.tsx — aqui só
 * sincronizamos o estado React com o que já está no DOM.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      if (next === "light") {
        document.documentElement.setAttribute("data-theme", "light");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      try {
        localStorage.setItem("theme", next);
      } catch {
        // localStorage indisponível (modo privado etc.) — tema só não persiste entre visitas.
      }
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
      <Toaster richColors position="top-right" theme={theme} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
