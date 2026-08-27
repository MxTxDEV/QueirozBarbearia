import { createCustomerAction } from "@/actions/customers";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Novo cliente</h1>
      <Card>
        <CardHeader>
          <p className="text-sm text-foreground-muted">O WhatsApp é validado e usado para evitar cadastros duplicados.</p>
        </CardHeader>
        <CardContent>
          <CustomerForm action={createCustomerAction} />
        </CardContent>
      </Card>
    </div>
  );
}
