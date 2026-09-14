"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, MapPin, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const PRICE_OPTIONS = [
  { label: "Qualquer preço", value: "" },
  { label: "Até R$ 30", value: "30" },
  { label: "Até R$ 50", value: "50" },
  { label: "Até R$ 80", value: "80" },
  { label: "Até R$ 120", value: "120" },
];

export function AgendarFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [name, setName] = useState(searchParams.get("q") ?? "");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const firstRender = useRef(true);

  const hasLocation = searchParams.has("lat") && searchParams.has("lng");

  function updateParams(update: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(update)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  // Busca por nome com debounce — evita disparar uma navegação a cada tecla.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => updateParams({ q: name || null }), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setLocError("Geolocalização não suportada pelo seu navegador.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        updateParams({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
      },
      () => {
        setLocating(false);
        setLocError("Não foi possível obter sua localização. Verifique a permissão do navegador.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="mb-8 space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Buscar barbearia pelo nome..."
            className="pl-9"
          />
        </div>

        <Select
          value={searchParams.get("maxPrice") ?? ""}
          onChange={(e) => updateParams({ maxPrice: e.target.value || null })}
          className="sm:w-48"
        >
          {PRICE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        {hasLocation ? (
          <Button type="button" variant="secondary" onClick={() => updateParams({ lat: null, lng: null })}>
            <X className="h-4 w-4" /> Limpar localização
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={handleUseLocation} disabled={locating}>
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {locating ? "Localizando..." : "Perto de mim"}
          </Button>
        )}
      </div>
      {locError && <p className="text-xs text-danger">{locError}</p>}
      {hasLocation && <p className="text-xs text-foreground-muted">Mostrando as barbearias mais próximas de você primeiro.</p>}
    </div>
  );
}
