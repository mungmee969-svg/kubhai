"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorFromSession, getSession, setSession } from "@/lib/auth/session";
import { requireStoreContext } from "@/lib/auth/tenant";
import { getStore } from "@/lib/data";
import { resolveKubHaiSaasPaymentConfig } from "@/lib/domain/saas-plans";

export type SaasActionResult = { ok: true } | { ok: false; error: string };

const MAX_SAAS_SLIP_BYTES = 2 * 1024 * 1024;
const SAAS_SLIP_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "ไม่สามารถดำเนินการได้";
}

export async function submitSaasPaymentProofAction(
  _previous: SaasActionResult | null,
  formData: FormData,
): Promise<SaasActionResult> {
  try {
    const ctx = await requireStoreContext();
    if (!ctx.businessId) return { ok: false, error: "ไม่พบร้าน" };
    if (!resolveKubHaiSaasPaymentConfig().configured) {
      return {
        ok: false,
        error: "KubHai ยังไม่ได้ตั้งค่าช่องทางรับเงินค่าบริการ",
      };
    }
    const file = formData.get("slip");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "กรุณาแนบรูปหลักฐานการชำระ" };
    }
    if (!SAAS_SLIP_MIMES.has(file.type) || file.size > MAX_SAAS_SLIP_BYTES) {
      return { ok: false, error: "รองรับ JPG, PNG, WebP ขนาดไม่เกิน 2 MB" };
    }
    const amount = Number(formData.get("submittedAmountThb"));
    await ctx.store.submitSaasPaymentProof(ctx.actor, {
      businessId: ctx.businessId,
      billingPeriodId: String(formData.get("billingPeriodId") ?? ""),
      submittedAmountThb: amount,
      originalFileName: file.name || "saas-payment-slip",
      mime: file.type as "image/jpeg" | "image/png" | "image/webp",
      imageDataUrl: `data:${file.type};base64,${Buffer.from(
        await file.arrayBuffer(),
      ).toString("base64")}`,
    });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/store/billing");
  redirect("/store/billing?submitted=1");
}

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("สำหรับผู้ดูแลแพลตฟอร์มเท่านั้น");
  }
  return { session, actor: actorFromSession(session), store: getStore() };
}

export async function reviewSaasPaymentProofAction(formData: FormData): Promise<void> {
  const ctx = await requireSuperAdmin();
  await ctx.store.reviewSaasPaymentProof(
    ctx.actor,
    String(formData.get("proofId") ?? ""),
    {
      decision:
        formData.get("decision") === "REJECT" ? "REJECT" : "APPROVE",
      reason: String(formData.get("reason") ?? "").trim() || null,
    },
  );
  revalidatePath("/admin");
  revalidatePath("/admin/saas-payments");
  revalidatePath("/admin/stores");
}

export async function updateSaasSubscriptionAction(formData: FormData): Promise<void> {
  const ctx = await requireSuperAdmin();
  const rawPlan = String(formData.get("planId") ?? "");
  const rawStatus = String(formData.get("status") ?? "");
  await ctx.store.updateSaasSubscription(
    ctx.actor,
    String(formData.get("subscriptionId") ?? ""),
    {
      planId:
        rawPlan === "starter" || rawPlan === "pro" || rawPlan === "business"
          ? rawPlan
          : undefined,
      status:
        rawStatus === "PENDING_PAYMENT" ||
        rawStatus === "ACTIVE" ||
        rawStatus === "PAST_DUE" ||
        rawStatus === "SUSPENDED" ||
        rawStatus === "CANCELLED"
          ? rawStatus
          : undefined,
      extendUntil: String(formData.get("extendUntil") ?? "").trim() || undefined,
      reason: String(formData.get("reason") ?? ""),
    },
  );
  revalidatePath("/admin");
  revalidatePath("/admin/stores");
}

export async function issueSaasBillingPeriodAction(formData: FormData): Promise<void> {
  const ctx = await requireSuperAdmin();
  const rawPlan = String(formData.get("planId") ?? "");
  if (rawPlan !== "starter" && rawPlan !== "pro" && rawPlan !== "business") {
    throw new Error("กรุณาเลือกแพ็กเกจ");
  }
  await ctx.store.issueSaasBillingPeriod(
    ctx.actor,
    String(formData.get("businessId") ?? ""),
    {
      planId: rawPlan,
      periodStart: String(formData.get("periodStart") ?? ""),
      dueAt: String(formData.get("dueAt") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    },
  );
  revalidatePath("/admin");
  revalidatePath("/admin/stores");
}

export async function provisionMerchantAction(
  _previous: SaasActionResult | null,
  formData: FormData,
): Promise<SaasActionResult> {
  let result;
  try {
    const rawPlan = String(formData.get("planId") ?? "");
    if (rawPlan !== "starter" && rawPlan !== "pro" && rawPlan !== "business") {
      return { ok: false, error: "กรุณาเลือกแพ็กเกจ" };
    }
    result = await getStore().provisionMerchant({
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      storeName: String(formData.get("storeName") ?? ""),
      storeSlug: String(formData.get("storeSlug") ?? ""),
      planId: rawPlan,
    });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  await setSession({
    userId: result.profile.id,
    email: result.profile.email,
    role: "BUSINESS_OWNER",
    businessIds: [result.business.id],
    exp: Date.now() + 1000 * 60 * 60 * 12,
  });
  redirect("/store/billing?welcome=1");
}
