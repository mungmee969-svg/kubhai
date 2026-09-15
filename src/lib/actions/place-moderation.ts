"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

export async function reviewPlatformPlaceAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAdmin();
  const placeId = String(formData.get("placeId") ?? "");
  const decision =
    formData.get("decision") === "REJECT" ? "REJECT" : "APPROVE";
  const reason = String(formData.get("reason") ?? "").trim() || null;
  await ctx.store.reviewPlatformPlace(ctx.actor, placeId, {
    decision,
    reason,
  });
  revalidatePath("/admin/places");
  revalidatePath("/admin/website");
  revalidatePath("/");
  revalidatePath("/places");
}
