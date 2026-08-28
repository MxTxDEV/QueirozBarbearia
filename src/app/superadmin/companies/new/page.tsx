import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewCompanyForm } from "./new-company-form";

export default function NewCompanyPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Nova empresa</h1>
      <Card>
        <CardHeader>
          <CardTitle>Dados da barbearia e do administrador inicial</CardTitle>
        </CardHeader>
        <CardContent>
          <NewCompanyForm />
        </CardContent>
      </Card>
    </div>
  );
}
