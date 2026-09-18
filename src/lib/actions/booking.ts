"use server";

import { redirect } from "next/navigation";
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

  const session = await getCustomerSession();
  if (!session) {
    const slug = parsed.payload.businessSlug;
    const next = `/s/${slug}`;
    redirect(
      `/account/login?store=${encodeURIComponent(slug)}&context=booking&next=${encodeURIComponent(next)}`,
    );
  }
  if (!session.phoneVerified) {
    redirect("/account/security");
  }

  try {
    const input = parsed.payload as BookingRequestInput;

    // Resolve the exact storefront selected by the customer. BookingRequestInput
    // intentionally carries only the store slug; the server/database resolves the
    // authoritative business id from that slug. This prevents a browser from
    // supplying another tenant id or broadcasting one request to multiple stores.
    const selectedStore = await getStore().getPublicStore(input.businessSlug);
    if (!selectedStore?.business || selectedStore.business.slug !== input.businessSlug) {
      console.error("[booking] rejected unknown store routing", {
        businessSlug: input.businessSlug,
      });
      return {
        ok: false,
        code: "STORE_MISMATCH",
        error: "ไม่พบร้านที่เลือก กรุณากลับไปเลือกร้านอีกครั้ง",
      };
    }

    const tenantLockedInput: BookingRequestInput = {
      ...input,
      businessSlug: selectedStore.business.slug,
    };

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
