"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession, getSession } from "@/lib/auth/session";
import { DomainError, ConflictError, TenantIsolationError, getStore } from "@/lib/data";
import {
  EARLY_COMPLETION_REASONS,
  type EarlyCompletionReason,
} from "@/lib/domain/customer-auth";

export type CloseoutActionResult = { ok: true } | { ok: false; error: string };

async function requireStoreActor() {
  const session = await getSession();
  if (!session) throw new TenantIsolationError("กรุณาเข้าสู่ระบบ");
  if (session.role === "CUSTOMER") throw new TenantIsolationError("ไม่มีสิทธิ์");
  return actorFromSession(session);
}

export async function completeBookingAction(
  bookingId: string,
  input: {
    earlyCompletionReason?: EarlyCompletionReason | null;
    earlyCompletionNote?: string | null;
    acknowledgeOutstanding?: boolean;
  } = {},
): Promise<CloseoutActionResult> {
  if (
    input.earlyCompletionReason &&
    !EARLY_COMPLETION_REASONS.includes(input.earlyCompletionReason)
  ) {
    return { ok: false, error: "เหตุผลการจบงานไม่ถูกต้อง" };
  }
  try {
    const actor = await requireStoreActor();
    await getStore().completeBooking(actor, bookingId, input);
    revalidatePath("/store");
    revalidatePath("/store/bookings");
    revalidatePath("/store/calendar");
    revalidatePath("/store/finance");
    revalidatePath(`/store/bookings/${bookingId}`);
    return { ok: true };
  } catch (error) {
    if (
      error instanceof DomainError ||
      error instanceof ConflictError ||
      error instanceof TenantIsolationError
    ) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "จบงานไม่สำเร็จ" };
  }
}
