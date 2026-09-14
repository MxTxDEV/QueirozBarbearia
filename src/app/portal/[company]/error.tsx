"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[portal error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-4">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <AlertTriangle className="h-10 w-10 text-danger" />
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-foreground">Algo deu errado</h1>
            <p className="text-sm text-foreground-muted">
              Ocorreu um erro inesperado nesta página. Você pode tentar novamente ou navegar para outra seção.
            </p>
          </div>
          <Button onClick={() => reset()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    </div>
  );
}
