"use server";

import { ConflictError, DomainError, getStore } from "@/lib/data";
import { getCustomerSession } from "@/lib/auth/customer-session";
import {
  createDurableBookingRequest,
  isDurableBookingConfigured,
} from "@/lib/data/supabase-booking";
import {
  logBookingValidationFailure,
  parseBookingSubmitPayload,
  type BookingFieldIssue,
} from "@/lib/booking/submit";
import type { BookingRequestInput } from "@/lib/domain/types";

export type BookingActionResult =
  | { ok: true; token: string; bookingCode: string; reused: boolean }
  | { ok: false; error: string; issues?: BookingFieldIssue[]; code?: "AUTH_REQUIRED" | "PHONE_VERIFICATION_REQUIRED" | "STORE_MISMATCH" };

function bookingErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause:
        error.cause instanceof Error
          ? { name: error.cause.name, message: error.cause.message }
          : error.cause == null
            ? undefined
            : String(error.cause),
      stack: error.stack,
    };
  }
  return { value: String(error) };
}

export async function submitBookingRequest(
  raw: unknown,
): Promise<BookingActionResult> {
  const parsed = parseBookingSubmitPayload(raw);
  if (!parsed.ok) {
    logBookingValidationFailure(parsed.issues);
    return { ok: false, error: parsed.error, issues: parsed.issues };
  }

  // A booking is a customer-owned transaction. Never create a production
  // booking for an anonymous visitor or an unverified phone number.
  const session = await getCustomerSession();
  if (!session) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      error: "กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนส่งคำขอจอง",
    };
  }
  if (!session.phoneVerified) {
    return {
      ok: false,
      code: "PHONE_VERIFICATION_REQUIRED",
      error: "กรุณายืนยันเบอร์โทรด้วย OTP ก่อนส่งคำขอจอง",
    };
  }

  try {
    const input = parsed.payload as BookingRequestInput;

    // Resolve the exact storefront selected by the customer and bind the
    // booking to that tenant. Never fan a booking out to every store and never
    // trust a client-supplied business id by itself.
    const selectedStore = await getStore().getPublicStore(input.businessSlug);
    if (!selectedStore?.business || selectedStore.business.id !== input.businessId) {
      console.error("[booking] rejected store routing mismatch", {
        businessSlug: input.businessSlug,
        suppliedBusinessId: input.businessId,
        resolvedBusinessId: selectedStore?.business?.id ?? null,
      });
      return {
        ok: false,
        code: "STORE_MISMATCH",
        error: "ร้านที่เลือกไม่ตรงกับคำขอจอง กรุณากลับไปเลือกร้านอีกครั้ง",
      };
    }

    const tenantLockedInput: BookingRequestInput = {
      ...input,
      businessId: selectedStore.business.id,
      businessSlug: selectedStore.business.slug,
    };

    // Production uses durable Supabase persistence. Local development keeps the
    // existing JSON store so the fixture-heavy developer workflow is unchanged.
    if (isDurableBookingConfigured()) {
      const result = await createDurableBookingRequest(tenantLockedInput);
      return {
        ok: true,
        token: result.token,
        bookingCode: result.bookingCode,
        reused: result.reused,
      };
    }

    const result = await getStore().createBookingRequest(tenantLockedInput);
    return {
      ok: true,
      token: result.booking.securePublicToken,
      bookingCode: result.booking.bookingCode,
      reused: result.reused,
    };
  } catch (error) {
    // Keep customer PII and the full booking payload out of production logs.
    // This diagnostic records only safe routing/context plus the exception.
    console.error("[booking] createBookingRequest failed", {
      businessSlug: parsed.payload.businessSlug,
      serviceType: parsed.payload.serviceType,
      persistence: isDurableBookingConfigured() ? "supabase" : "local",
      error: bookingErrorForLog(error),
    });

    if (error instanceof DomainError || error instanceof ConflictError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
