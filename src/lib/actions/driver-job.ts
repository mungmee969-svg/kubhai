"use server";

import { revalidatePath } from "next/cache";
import { ConflictError, DomainError, TenantIsolationError, getStore } from "@/lib/data";
import { driverJobPath } from "@/lib/domain/driver-job";

export type DriverJobActionResult =
  | { ok: true }
  | { ok: false; error: string };

function fail(error: unknown): DriverJobActionResult {
  if (
    error instanceof DomainError ||
    error instanceof ConflictError ||
    error instanceof TenantIsolationError
  ) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "ดำเนินการไม่สำเร็จ" };
}

function revalidateDriverJob(token: string, bookingId?: string) {
  revalidatePath(driverJobPath(token));
  if (bookingId) {
    revalidatePath(`/store/bookings/${bookingId}`);
    revalidatePath("/store/bookings");
  }
}

export async function openDriverJobAction(token: string): Promise<DriverJobActionResult> {
  try {
    const record = await getStore().openDriverJob(token);
    if (!record) return { ok: false, error: "ลิงก์งานหมดอายุหรือไม่ถูกต้อง" };
    revalidateDriverJob(token, record.booking.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function startDriverDayAction(
  token: string,
  dayNumber: number,
): Promise<DriverJobActionResult> {
  try {
    const record = await getStore().startDriverDay(token, dayNumber);
    revalidateDriverJob(token, record.booking.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function endDriverDayAction(
  token: string,
  dayNumber: number,
): Promise<DriverJobActionResult> {
  try {
    const record = await getStore().endDriverDay(token, dayNumber);
    revalidateDriverJob(token, record.booking.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function submitDriverSuggestionAction(
  token: string,
  input: { body: string; dayNumber?: number | null },
): Promise<DriverJobActionResult> {
  try {
    const suggestion = await getStore().submitDriverSuggestion(token, input);
    revalidateDriverJob(token, suggestion.bookingId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
