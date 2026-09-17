"use server";

import { ConflictError, DomainError, getStore } from "@/lib/data";
import {
  logBookingValidationFailure,
  parseBookingSubmitPayload,
  type BookingFieldIssue,
} from "@/lib/booking/submit";
import type { BookingRequestInput } from "@/lib/domain/types";

export type BookingActionResult =
  | { ok: true; token: string; bookingCode: string; reused: boolean }
  | { ok: false; error: string; issues?: BookingFieldIssue[] };

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

  try {
    const store = getStore();
    const result = await store.createBookingRequest(
      parsed.payload as BookingRequestInput,
    );
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
      error: bookingErrorForLog(error),
    });

    if (error instanceof DomainError || error instanceof ConflictError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
