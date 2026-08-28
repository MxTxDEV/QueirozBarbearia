import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { CompanyUnavailable } from "@/components/company-unavailable";
import { Button } from "@/components/ui/button";

export default async function SuspendedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.companyStatus || user.companyStatus === "ACTIVE") redirect("/admin/dashboard");

  return (
    <div className="space-y-4">
      <CompanyUnavailable name={user.companyName ?? "Sua empresa"} status={user.companyStatus} />
      <div className="flex justify-center">
        <form action={logoutAction}>
          <Button type="submit" variant="secondary">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
