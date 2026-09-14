"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession, getSession } from "@/lib/auth/session";
import { DomainError, ConflictError, TenantIsolationError, getStore } from "@/lib/data";
import {
  LOCATION_OVERRIDE_REASONS,
  type LocationOverrideReason,
} from "@/lib/domain/location";

export type TripActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireStoreActor() {
  const session = await getSession();
  if (!session) throw new TenantIsolationError("กรุณาเข้าสู่ระบบ");
  if (session.role === "CUSTOMER") throw new TenantIsolationError("ไม่มีสิทธิ์");
  return actorFromSession(session);
}

function revalidateTrip(bookingId: string) {
  revalidatePath("/store");
  revalidatePath("/store/bookings");
  revalidatePath("/store/calendar");
  revalidatePath(`/store/bookings/${bookingId}`);
}

export async function recordTripCheckInAction(
  bookingId: string,
  input: {
    kind: "PICKUP" | "DROPOFF";
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    overrideReason?: string | null;
    note?: string | null;
  },
): Promise<TripActionResult> {
  if (input.kind !== "PICKUP" && input.kind !== "DROPOFF") {
    return { ok: false, error: "ชนิดเช็กอินไม่ถูกต้อง" };
  }
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return { ok: false, error: "พิกัดไม่ถูกต้อง" };
  }
  const override =
    input.overrideReason &&
    LOCATION_OVERRIDE_REASONS.includes(input.overrideReason as LocationOverrideReason)
      ? (input.overrideReason as LocationOverrideReason)
      : null;
  try {
    const actor = await requireStoreActor();
    // Actor identity comes from session — never trust client-supplied userId / businessId
    await getStore().recordTripCheckIn(actor, bookingId, {
      kind: input.kind,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters ?? null,
      overrideReason: override,
      note: input.note ?? null,
    });
    revalidateTrip(bookingId);
    return { ok: true };
  } catch (error) {
    if (
      error instanceof DomainError ||
      error instanceof ConflictError ||
      error instanceof TenantIsolationError
    ) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "ยังบันทึกเช็กอินไม่สำเร็จ" };
  }
}

export async function startTripAction(bookingId: string): Promise<TripActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().startTrip(actor, bookingId);
    revalidateTrip(bookingId);
    return { ok: true };
  } catch (error) {
    if (
      error instanceof DomainError ||
      error instanceof ConflictError ||
      error instanceof TenantIsolationError
    ) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "เริ่มงานไม่สำเร็จ" };
  }
}
