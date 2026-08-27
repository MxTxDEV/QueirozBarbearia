import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/admin/dashboard");

  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold text-foreground">Painel administrativo</h1>
        <p className="text-sm text-foreground-muted">Entre para gerenciar sua barbearia.</p>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
