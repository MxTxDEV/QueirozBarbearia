import "server-only";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer-auth";

export async function requireCustomerContext() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/portal/login");
  return customer;
}
