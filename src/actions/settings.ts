"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/require-admin";
import { actionError, actionSuccess, type ActionResult } from "@/lib/action-helpers";

const schema = z.object({ systemName: z.string().min(2, "Informe um nome.") });

export async function updateSystemNameAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdminOnly();
    const data = schema.parse({ systemName: formData.get("systemName") });

    await prisma.systemSetting.upsert({
      where: { key: "system_name" },
      update: { value: data.systemName },
      create: { key: "system_name", value: data.systemName },
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/settings");
  return actionSuccess();
}
