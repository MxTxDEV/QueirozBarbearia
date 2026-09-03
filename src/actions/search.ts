"use server";

import { requireAdminContext } from "@/lib/require-admin";
import { globalSearch, type SearchResult } from "@/lib/data/search";

export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  const user = await requireAdminContext();
  return globalSearch(user.companyId, query, user.role === "ADMIN");
}
