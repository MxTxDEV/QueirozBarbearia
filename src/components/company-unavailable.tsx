import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { stopImpersonationAction } from "@/actions/superadmin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type CompanyUnavailableReason = "SUSPENDED" | "BLOCKED" | "BOOKING_DISABLED";

const MESSAGE: Record<CompanyUnavailableReason, string> = {
  SUSPENDED: "Esta barbearia está temporariamente suspensa. Tente novamente mais tarde ou fale diretamente com ela.",
  BLOCKED: "Esta barbearia está indisponível no momento.",
  BOOKING_DISABLED: "O agendamento online está temporariamente indisponível para esta barbearia. Entre em contato diretamente com ela.",
};

/**
 * Tela amigável exibida quando a empresa (tenant) está SUSPENDED/BLOCKED, ou desligou o agendamento online — nunca deixa passar para telas com dados.
 *
 * Quem é Super Admin da plataforma (inclusive entrando como admin de uma empresa
 * indisponível) nunca fica preso aqui: sempre há um botão de volta ao painel
 * Super Admin. `children` entra dentro do cartão (ex.: "Sair" de quem é da empresa).
 */
export async function CompanyUnavailable({
  name,
  status,
  children,
}: {
  name: string;
  status: CompanyUnavailableReason;
  children?: React.ReactNode;
}) {
  const viewer = await getCurrentUser();
  const impersonating = !!viewer?.impersonatedBy;
  const isSuperAdmin = viewer?.role === "SUPERADMIN";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <h1 className="text-lg font-semibold text-foreground">{name}</h1>
          <p className="text-sm text-foreground-muted">{MESSAGE[status]}</p>

          {impersonating ? (
            <form action={stopImpersonationAction.bind(null, "/superadmin/dashboard")} className="pt-2">
              <Button type="submit">Voltar ao painel Super Admin</Button>
            </form>
          ) : isSuperAdmin ? (
            <Link href="/superadmin/dashboard" className="pt-2">
              <Button type="button">Voltar ao painel Super Admin</Button>
            </Link>
          ) : (
            children && <div className="pt-2">{children}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
