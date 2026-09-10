import { requireAdminContext } from "@/lib/require-admin";
import { getPdvBootstrapData, getTodaySalesSummary, listTodaySales } from "@/lib/data/pdv";
import { listCustomers } from "@/lib/data/customers";
import { PdvClient } from "./pdv-client";

export default async function PdvPage() {
  const user = await requireAdminContext();
  const isAdmin = user.role === "ADMIN";
  const scopedBarberId = isAdmin ? undefined : (user.barberId ?? undefined);

  const [bootstrap, summary, todaySales, customers] = await Promise.all([
    getPdvBootstrapData(user.companyId, scopedBarberId),
    getTodaySalesSummary(user.companyId),
    listTodaySales(user.companyId, scopedBarberId),
    listCustomers(user.companyId),
  ]);

  return (
    <PdvClient
      barbers={bootstrap.barbers}
      services={bootstrap.services}
      products={bootstrap.products}
      todayAppointments={bootstrap.todayAppointments}
      customers={customers.map((c) => ({ id: c.id, fullName: c.fullName, whatsapp: c.whatsapp }))}
      summary={summary}
      todaySales={todaySales}
      lockedBarberId={isAdmin ? undefined : scopedBarberId}
    />
  );
}
