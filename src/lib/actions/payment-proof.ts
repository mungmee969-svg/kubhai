"use server";

import { revalidatePath } from "next/cache";
import { DomainError, TenantIsolationError, getStore } from "@/lib/data";
import { allocationsFromIntent, PAYMENT_PROOF_INTENTS } from "@/lib/domain/payment-accounts";
import type { PaymentProofIntent } from "@/lib/domain/types";

export type ProofActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown, fallback: string): ProofActionResult {
  if (error instanceof DomainError || error instanceof TenantIsolationError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: fallback };
}

export async function submitCustomerPaymentProofAction(formData: FormData): Promise<ProofActionResult> {
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const intentRaw = String(formData.get("paymentIntent") ?? "");
  const claimedAmount = Number(formData.get("claimedAmount") ?? 0);
  const serviceAmount = Number(formData.get("serviceAmount") ?? 0);
  const tipAmount = Number(formData.get("tipAmount") ?? 0);
  const file = formData.get("slip");
  if (!token || token.length < 20 || !bookingId) {
    return { ok: false, error: "ลิงก์การจองไม่ถูกต้อง" };
  }
  if (!PAYMENT_PROOF_INTENTS.includes(intentRaw as PaymentProofIntent)) {
    return { ok: false, error: "เลือกประเภทการโอน" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "อัปโหลดสลิปก่อนส่ง" };
  }
  if (file.size > 6_000_000) return { ok: false, error: "ไฟล์ใหญ่เกิน 6MB" };
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return { ok: false, error: "ใช้ไฟล์ JPG/PNG/WEBP เท่านั้น" };

  const intent = intentRaw as PaymentProofIntent;
  const allocations = allocationsFromIntent(intent, claimedAmount, serviceAmount, tipAmount);
  const actor = { kind: "booking_token" as const, token };

  try {
    const store = getStore();
    const record = await store.getBookingByToken(token);
    if (!record || record.booking.id !== bookingId) {
      return { ok: false, error: "ไม่พบการจองนี้" };
    }
    if (record.proofs.some((item) => item.reviewStatus === "PENDING_REVIEW")) {
      return { ok: false, error: "มีสลิปที่รอตรวจสอบอยู่แล้ว" };
    }
    const slip = await store.writeSlipFile(actor, {
      bookingId,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: file.type,
      originalName: file.name,
    });
    await store.submitPaymentProof(actor, {
      bookingId,
      paymentIntent: intent,
      claimedAmount,
      allocations,
      slipFileId: slip.id,
      submittedBy: "CUSTOMER",
    });
    revalidatePath(`/booking/${token}`);
    return { ok: true };
  } catch (error) {
    return fail(error, "ส่งสลิปไม่สำเร็จ");
  }
}
