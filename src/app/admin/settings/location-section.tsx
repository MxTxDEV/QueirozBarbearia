"use client";

import { useActionState, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-helpers";
import { updateLocationAction } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

type LocationDefaults = {
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
};

export function LocationSection({ defaults }: { defaults: LocationDefaults }) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(updateLocationAction, undefined);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    defaults.latitude != null && defaults.longitude != null ? { lat: defaults.latitude, lng: defaults.longitude } : null
  );
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocError("Seu navegador não suporta geolocalização.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Não foi possível obter sua localização. Verifique a permissão do navegador.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="address">Endereço</Label>
        <Input id="address" name="address" defaultValue={defaults.address} placeholder="Rua, número" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input id="neighborhood" name="neighborhood" defaultValue={defaults.neighborhood} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zipCode">CEP</Label>
          <Input id="zipCode" name="zipCode" defaultValue={defaults.zipCode} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" name="city" defaultValue={defaults.city} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="state">UF</Label>
          <Input id="state" name="state" maxLength={2} defaultValue={defaults.state} onChange={(e) => (e.target.value = e.target.value.toUpperCase())} />
        </div>
      </div>

      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />

      <div className="space-y-2 rounded-xl border p-3">
        <p className="text-sm font-medium text-foreground">Coordenadas (para ordenar por distância)</p>
        <p className="text-xs text-foreground-muted">
          {coords
            ? `Definidas: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
            : "Ainda não definidas — sua barbearia não aparecerá ordenada por proximidade em /agendar."}
        </p>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary-light hover:underline disabled:opacity-50"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {locating ? "Localizando..." : "Usar minha localização atual"}
        </button>
        {locError && <p className="text-xs text-danger">{locError}</p>}
        <p className="text-xs text-foreground-muted">Use este botão estando fisicamente na barbearia, antes de salvar.</p>
      </div>

      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && <p className="text-sm text-success">Localização salva!</p>}
      <SubmitButton pendingText="Salvando...">Salvar localização</SubmitButton>
    </form>
  );
}
