"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession, getSession } from "@/lib/auth/session";
import { ConflictError, DomainError, TenantIsolationError, getStore } from "@/lib/data";
import { quotationChangeSchema, quotationDraftSchema } from "@/lib/validation/quotation";
import type { QuotationDraftInput, QuotationRecord } from "@/lib/data/repository";

export type QuotationActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function storeActor() {
  const session = await getSession();
  if (!session) throw new TenantIsolationError("กรุณาเข้าสู่ระบบ");
  return actorFromSession(session);
}

function fail(error: unknown, fallback = "ดำเนินการไม่สำเร็จ"): QuotationActionResult<never> {
  if (error instanceof DomainError || error instanceof ConflictError || error instanceof TenantIsolationError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: fallback };
}

function refresh(bookingId: string, token?: string | null) {
  revalidatePath("/store/bookings");
  revalidatePath(`/store/bookings/${bookingId}`);
  if (token) revalidatePath(`/booking/${token}`);
}

export async function createQuotationDraftAction(
  bookingId: string,
): Promise<QuotationActionResult<{ id: string; quote: QuotationRecord }>> {
  try {
    const quote = await getStore().createQuotationDraft(await storeActor(), bookingId);
    refresh(bookingId);
    return { ok: true, data: { id: quote.id, quote } };
  } catch (error) {
    return fail(error, "สร้างใบเสนอราคาไม่สำเร็จ");
  }
}

export async function updateQuotationDraftAction(
  quotationId: string,
  bookingId: string,
  raw: unknown,
): Promise<QuotationActionResult> {
  const parsed = quotationDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลใบเสนอราคาไม่ถูกต้อง" };
  try {
    await getStore().updateQuotationDraft(await storeActor(), quotationId, parsed.data as QuotationDraftInput);
    refresh(bookingId);
    return { ok: true };
  } catch (error) {
    return fail(error, "บันทึกร่างไม่สำเร็จ");
  }
}

export async function sendQuotationAction(
  quotationId: string,
  bookingId: string,
): Promise<QuotationActionResult> {
  try {
    const actor = await storeActor();
    await getStore().sendQuotation(actor, quotationId);
    const record = await getStore().getBookingById(actor, bookingId);
    refresh(bookingId, record?.booking.securePublicToken);
    return { ok: true };
  } catch (error) {
    return fail(error, "ส่งใบเสนอราคาไม่สำเร็จ");
  }
}

export async function createQuotationRevisionAction(
  quotationId: string,
  bookingId: string,
): Promise<QuotationActionResult<{ id: string; quote: QuotationRecord }>> {
  try {
    const quote = await getStore().createQuotationRevision(await storeActor(), quotationId);
    refresh(bookingId);
    return { ok: true, data: { id: quote.id, quote } };
  } catch (error) {
    return fail(error, "สร้างฉบับแก้ไขไม่สำเร็จ");
  }
}

export async function cancelQuotationAction(
  quotationId: string,
  bookingId: string,
): Promise<QuotationActionResult> {
  try {
    await getStore().cancelQuotation(await storeActor(), quotationId);
    refresh(bookingId);
    return { ok: true };
  } catch (error) {
    return fail(error, "ยกเลิกใบเสนอราคาไม่สำเร็จ");
  }
}

export async function acceptQuotationAction(
  token: string,
  quotationId: string,
): Promise<QuotationActionResult> {
  if (!token || token.length < 20) return { ok: false, error: "ลิงก์การจองไม่ถูกต้อง" };
  try {
    const store = getStore();
    const record = await store.getBookingByToken(token);
    if (!record) return { ok: false, error: "ไม่พบการจองนี้" };
    await store.acceptQuotation({ kind: "booking_token", token }, quotationId);
    refresh(record.booking.id, token);
    return { ok: true };
  } catch (error) {
    return fail(error, "ยืนยันใบเสนอราคาไม่สำเร็จ");
  }
}

export async function requestQuotationChangeAction(
  token: string,
  quotationId: string,
  text: string,
): Promise<QuotationActionResult> {
  if (!token || token.length < 20) return { ok: false, error: "ลิงก์การจองไม่ถูกต้อง" };
  const parsed = quotationChangeSchema.safeParse({ text });
  if (!parsed.success) return { ok: false, error: "บอกสิ่งที่ต้องการแก้ไข" };
  try {
    const store = getStore();
    const record = await store.getBookingByToken(token);
    if (!record) return { ok: false, error: "ไม่พบการจองนี้" };
    await store.requestQuotationChange({ kind: "booking_token", token }, quotationId, parsed.data.text);
    refresh(record.booking.id, token);
    return { ok: true };
  } catch (error) {
    return fail(error, "ส่งคำขอแก้ไขไม่สำเร็จ");
  }
}

export async function rejectQuotationAction(
  token: string,
  quotationId: string,
  reason: string | null,
): Promise<QuotationActionResult> {
  if (!token || token.length < 20) return { ok: false, error: "ลิงก์การจองไม่ถูกต้อง" };
  try {
    const store = getStore();
    const record = await store.getBookingByToken(token);
    if (!record) return { ok: false, error: "ไม่พบการจองนี้" };
    await store.rejectQuotation({ kind: "booking_token", token }, quotationId, reason);
    refresh(record.booking.id, token);
    return { ok: true };
  } catch (error) {
    return fail(error, "ปฏิเสธใบเสนอราคาไม่สำเร็จ");
  }
}
