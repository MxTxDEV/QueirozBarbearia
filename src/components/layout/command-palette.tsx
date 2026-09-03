"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Scissors, UserCog, CornerDownLeft } from "lucide-react";
import { globalSearchAction } from "@/actions/search";
import type { SearchResult } from "@/lib/data/search";

const TYPE_ICON: Record<SearchResult["type"], typeof User> = {
  customer: User,
  service: Scissors,
  barber: UserCog,
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  customer: "Clientes",
  service: "Serviços",
  barber: "Barbeiros",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function openPalette() {
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const found = await globalSearchAction(query);
        setResults(found);
        setActiveIndex(0);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  const visibleResults = query.trim().length < 2 ? [] : results;

  function go(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visibleResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && visibleResults[activeIndex]) {
      e.preventDefault();
      go(visibleResults[activeIndex]);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPalette}
        className="flex items-center gap-2 rounded-xl border bg-[var(--surface-subtle)] px-2.5 py-2 text-sm text-foreground-muted hover:bg-[var(--surface-subtle-hover)] sm:px-3 sm:py-1.5"
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="ml-2 hidden rounded border px-1.5 py-0.5 text-[10px] text-foreground-muted/70 sm:inline">Ctrl K</kbd>
      </button>
    );
  }

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="glass-strong relative w-full max-w-lg rounded-2xl border shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Buscar clientes, serviços, barbeiros..."
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted/60"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim().length >= 2 && !isPending && visibleResults.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-foreground-muted">Nenhum resultado para &quot;{query}&quot;.</p>
          )}
          {query.trim().length < 2 && (
            <p className="px-3 py-6 text-center text-sm text-foreground-muted">Digite ao menos 2 caracteres para buscar.</p>
          )}
          {(["customer", "service", "barber"] as const).map((type) => {
            const group = visibleResults.filter((r) => r.type === type);
            if (group.length === 0) return null;
            const Icon = TYPE_ICON[type];
            return (
              <div key={type} className="mb-2">
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted/70">
                  {TYPE_LABEL[type]}
                </p>
                {group.map((r) => {
                  flatIndex++;
                  const isActive = flatIndex === activeIndex;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => go(r)}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        isActive ? "bg-[var(--surface-subtle-hover)] text-foreground" : "text-foreground-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{r.title}</span>
                      <span className="truncate text-xs text-foreground-muted/70">{r.subtitle}</span>
                      {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
