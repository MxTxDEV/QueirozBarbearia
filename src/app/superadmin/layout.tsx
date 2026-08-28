import { requireSuperAdmin } from "@/lib/require-admin";
import { SuperAdminShell } from "@/components/layout/superadmin-shell";

export default async function SuperAdminLayout({ children }: LayoutProps<"/">) {
  const user = await requireSuperAdmin();
  return <SuperAdminShell userName={user.name}>{children}</SuperAdminShell>;
}
