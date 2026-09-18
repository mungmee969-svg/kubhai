"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession, getSession } from "@/lib/auth/session";
import {
  ConflictError,
  DomainError,
  TenantIsolationError,
  getStore,
} from "@/lib/data";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/domain/enums";
import { assignDurableStoreBooking } from "@/lib/data/supabase-store-booking";
import type {
  BookingFinancePlan,
  MoneyMovementInput,
  PaymentAccountInput,
} from "@/lib/data/repository";
import type { MoneyAllocation } from "@/lib/domain/types";

export type StoreActionResult = { ok: true } | { ok: false; error: string };

async function requireStoreActor() {
  const session = await getSession();
  if (!session) throw new TenantIsolationError("กรุณาเข้าสู่ระบบ");
  return actorFromSession(session);
}

export async function updateBookingStatusAction(
  bookingId: string,
  status: BookingStatus,
  opts?: { reason?: string },
): Promise<StoreActionResult> {
  if (!BOOKING_STATUSES.includes(status)) {
    return { ok: false, error: "สถานะไม่ถูกต้อง" };
  }
  if (status === "COMPLETED") {
    return { ok: false, error: "ใช้หน้าจบงานเพื่อเสร็จสิ้นงาน" };
  }
  if (status === "CANCELLED" && !opts?.reason?.trim()) {
    return { ok: false, error: "กรุณาระบุเหตุผลยกเลิก" };
  }
  try {
    const actor = await requireStoreActor();
    await getStore().updateBookingStatus(actor, bookingId, status, {
      reason: opts?.reason?.trim() || null,
    });
    revalidatePath("/store");
    revalidatePath("/store/bookings");
    revalidatePath("/store/calendar");
    revalidatePath("/store/vehicles");
    revalidatePath("/store/drivers");
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
    return { ok: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  }
}

export async function assignBookingAction(
  bookingId: string,
  input: { vehicleId?: string | null; driverId?: string | null },
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    if (actor.kind !== "user" || !input.vehicleId || !input.driverId) {
      return { ok: false, error: "กรุณาเลือกรถและคนขับ" };
    }
    let durable = false;
    for (const businessId of actor.businessIds) {
      try {
        if (await assignDurableStoreBooking(businessId, bookingId, {
          vehicleId: input.vehicleId,
          driverId: input.driverId,
        })) {
          durable = true;
          break;
        }
      } catch {
        // The booking may belong to another authorized tenant; keep checking.
      }
    }
    if (!durable) {
      await getStore().assignBooking(actor, bookingId, input);
    }
    revalidatePath("/store");
    revalidatePath("/store/bookings");
    revalidatePath("/store/calendar");
    revalidatePath("/store/vehicles");
    revalidatePath("/store/drivers");
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
    return { ok: false, error: "มอบหมายไม่สำเร็จ" };
  }
}

function revalidateBookingMoney(bookingId: string) {
  revalidatePath("/store");
  revalidatePath("/store/bookings");
  revalidatePath("/store/finance");
  revalidatePath(`/store/bookings/${bookingId}`);
  revalidatePath("/booking", "layout");
}

export async function updateBookingFinancePlanAction(
  bookingId: string,
  patch: BookingFinancePlan,
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().updateBookingFinancePlan(actor, bookingId, patch);
    revalidateBookingMoney(bookingId);
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError || error instanceof TenantIsolationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "บันทึกยอดงานไม่สำเร็จ" };
  }
}

export async function recordMoneyMovementAction(
  bookingId: string,
  input: MoneyMovementInput,
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().recordMoneyMovement(actor, bookingId, input);
    revalidateBookingMoney(bookingId);
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError || error instanceof TenantIsolationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "บันทึกการเงินไม่สำเร็จ" };
  }
}

function failStore(error: unknown, fallback: string): StoreActionResult {
  if (error instanceof DomainError || error instanceof TenantIsolationError || error instanceof ConflictError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: fallback };
}

export async function upsertPaymentAccountAction(
  businessId: string,
  input: PaymentAccountInput,
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().upsertPaymentAccount(actor, businessId, input);
    revalidatePath("/store/settings");
    revalidatePath("/store/finance");
    revalidatePath("/store/bookings");
    return { ok: true };
  } catch (error) {
    return failStore(error, "บันทึกบัญชีไม่สำเร็จ");
  }
}

export async function setDefaultPaymentAccountAction(accountId: string): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().setDefaultPaymentAccount(actor, accountId);
    revalidatePath("/store/settings");
    return { ok: true };
  } catch (error) {
    return failStore(error, "ตั้งบัญชีหลักไม่สำเร็จ");
  }
}

export async function setPaymentAccountActiveAction(
  accountId: string,
  active: boolean,
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().setPaymentAccountActive(actor, accountId, active);
    revalidatePath("/store/settings");
    return { ok: true };
  } catch (error) {
    return failStore(error, "อัปเดตบัญชีไม่สำเร็จ");
  }
}

export async function setBookingReceivingAccountAction(
  bookingId: string,
  accountId: string,
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().setBookingReceivingAccount(actor, bookingId, accountId);
    revalidateBookingMoney(bookingId);
    return { ok: true };
  } catch (error) {
    return failStore(error, "เปลี่ยนบัญชีรับเงินไม่สำเร็จ");
  }
}

export async function updateProofAllocationAction(
  bookingId: string,
  proofId: string,
  allocations: MoneyAllocation[],
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().updatePaymentProofAllocation(actor, proofId, allocations);
    revalidateBookingMoney(bookingId);
    return { ok: true };
  } catch (error) {
    return failStore(error, "แก้การแบ่งยอดไม่สำเร็จ");
  }
}

export async function approvePaymentProofAction(
  bookingId: string,
  proofId: string,
  input?: { allocations?: MoneyAllocation[]; adminNote?: string | null },
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().approvePaymentProof(actor, proofId, input);
    revalidateBookingMoney(bookingId);
    return { ok: true };
  } catch (error) {
    return failStore(error, "อนุมัติสลิปไม่สำเร็จ");
  }
}

export async function rejectPaymentProofAction(
  bookingId: string,
  proofId: string,
  input: { reason: string; adminNote?: string | null },
): Promise<StoreActionResult> {
  try {
    const actor = await requireStoreActor();
    await getStore().rejectPaymentProof(actor, proofId, input);
    revalidateBookingMoney(bookingId);
    return { ok: true };
  } catch (error) {
    return failStore(error, "ปฏิเสธสลิปไม่สำเร็จ");
  }
}
