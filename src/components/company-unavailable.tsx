import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MESSAGE: Record<"SUSPENDED" | "BLOCKED", string> = {
  SUSPENDED: "Esta barbearia está temporariamente suspensa. Tente novamente mais tarde ou fale diretamente com ela.",
  BLOCKED: "Esta barbearia está indisponível no momento.",
};

/** Tela amigável exibida quando a empresa (tenant) está SUSPENDED ou BLOCKED — nunca deixa passar para telas com dados. */
export function CompanyUnavailable({ name, status }: { name: string; status: "SUSPENDED" | "BLOCKED" }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <h1 className="text-lg font-semibold text-foreground">{name}</h1>
          <p className="text-sm text-foreground-muted">{MESSAGE[status]}</p>
        </CardContent>
      </Card>
    </div>
  );
}
