"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { actorFromSession, getSession } from "@/lib/auth/session";
import {
  ConflictError,
  DomainError,
  TenantIsolationError,
  getStore,
} from "@/lib/data";
import { sniffImage } from "@/lib/data/image-bytes";
import { assertSafeStorageId } from "@/lib/data/private-slips";
import { newId } from "@/lib/domain/ids";
import {
  businessProfileSchema,
  driverSchema,
  itinerarySchema,
  opsSettingsSchema,
  placeSchema,
  storeTipsSchema,
  tripPatchSchema,
  vehicleSchema,
} from "@/lib/validation/ops";
import { deriveNotifications, searchBoard } from "@/lib/domain/ops";

export type OpsResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function actor() {
  const session = await getSession();
  if (!session) throw new TenantIsolationError("กรุณาเข้าสู่ระบบ");
  return actorFromSession(session);
}

function fail(error: unknown): OpsResult<never> {
  if (
    error instanceof DomainError ||
    error instanceof ConflictError ||
    error instanceof TenantIsolationError
  ) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "ดำเนินการไม่สำเร็จ" };
}

async function revalidateStorefront(businessId: string) {
  const sessionActor = await actor();
  const businesses = await getStore().listBusinesses(sessionActor);
  const slug = businesses.find((item) => item.id === businessId)?.slug;
  if (slug) revalidatePath(`/s/${slug}`);
}

export async function saveVehicleAction(
  businessId: string,
  raw: unknown,
): Promise<OpsResult<{ id: string }>> {
  const parsed = vehicleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลรถไม่ครบ" };
  try {
    const vehicle = await getStore().upsertVehicle(await actor(), businessId, parsed.data);
    revalidatePath("/store/vehicles");
    await revalidateStorefront(businessId);
    return { ok: true, data: { id: vehicle.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function setVehicleActiveAction(
  vehicleId: string,
  active: boolean,
): Promise<OpsResult> {
  try {
    const vehicle = await getStore().setVehicleActive(await actor(), vehicleId, active);
    revalidatePath("/store/vehicles");
    await revalidateStorefront(vehicle.businessId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveDriverAction(
  businessId: string,
  raw: unknown,
): Promise<OpsResult<{ id: string }>> {
  const parsed = driverSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลคนขับไม่ครบ" };
  try {
    const driver = await getStore().upsertDriver(await actor(), businessId, parsed.data);
    revalidatePath("/store/drivers");
    return { ok: true, data: { id: driver.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function setDriverActiveAction(
  driverId: string,
  active: boolean,
): Promise<OpsResult> {
  try {
    await getStore().setDriverActive(await actor(), driverId, active);
    revalidatePath("/store/drivers");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveBusinessProfileAction(
  businessId: string,
  raw: unknown,
): Promise<OpsResult> {
  const parsed = businessProfileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลร้านไม่ถูกต้อง" };
  try {
    await getStore().updateBusinessProfile(await actor(), businessId, parsed.data);
    revalidatePath("/store/settings");
    await revalidateStorefront(businessId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveFaqAction(
  businessId: string,
  faq: { question: string; answer: string }[],
  bookingNotes: string | null,
): Promise<OpsResult> {
  try {
    await getStore().updateSettings(await actor(), businessId, {
      faq: faq.filter((item) => item.question.trim() && item.answer.trim()),
      bookingNotes,
    });
    revalidatePath("/store/settings");
    await revalidateStorefront(businessId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveStoreTipsAction(
  businessId: string,
  raw: unknown,
): Promise<OpsResult> {
  const parsed = storeTipsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลคำแนะนำไม่ครบ" };
  try {
    const tips = parsed.data.map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      title: item.title,
      shortText: item.shortText,
      serviceType: item.serviceType,
      placeId: item.placeId,
      locationKeyword: item.locationKeyword,
      category: item.category,
      minPassengers: item.minPassengers,
      minLuggage: item.minLuggage,
      multiDayOnly: item.multiDayOnly,
      active: item.active,
      priority: item.priority,
      surfaces: item.surfaces,
    }));
    await getStore().updateSettings(await actor(), businessId, { tips });
    revalidatePath("/store/settings");
    await revalidateStorefront(businessId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTripAction(
  bookingId: string,
  raw: unknown,
): Promise<OpsResult> {
  const parsed = tripPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลทริปไม่ถูกต้อง" };
  try {
    await getStore().updateBookingTrip(await actor(), bookingId, parsed.data);
    revalidatePath(`/store/bookings/${bookingId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addNoteAction(
  bookingId: string,
  body: string,
  options?: { audience?: "INTERNAL" | "CUSTOMER"; title?: string | null },
): Promise<OpsResult> {
  try {
    const sessionActor = await actor();
    await getStore().addBookingNote(sessionActor, bookingId, body, options);
    revalidatePath(`/store/bookings/${bookingId}`);
    const record = await getStore().getBookingById(sessionActor, bookingId);
    if (record?.booking.securePublicToken) {
      revalidatePath(`/booking/${record.booking.securePublicToken}`);
      revalidatePath(`/account/bookings/${bookingId}`);
    }
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveItineraryAction(
  bookingId: string,
  raw: unknown,
): Promise<OpsResult> {
  const parsed = itinerarySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลแผนทริปไม่ครบ" };
  try {
    await getStore().upsertItineraryItem(await actor(), bookingId, parsed.data);
    revalidatePath(`/store/bookings/${bookingId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteItineraryAction(itemId: string, bookingId: string): Promise<OpsResult> {
  try {
    await getStore().deleteItineraryItem(await actor(), itemId);
    revalidatePath(`/store/bookings/${bookingId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadImageAction(formData: FormData): Promise<OpsResult<{ url: string }>> {
  const file = formData.get("file");
  const businessId = String(formData.get("businessId") ?? "");
  if (!(file instanceof File) || !businessId) {
    return { ok: false, error: "ไม่พบไฟล์" };
  }
  if (file.size > 4_000_000) return { ok: false, error: "ไฟล์ใหญ่เกิน 4MB" };
  try {
    const session = await actor();
    if (session.kind !== "user" || (!session.businessIds.includes(businessId) && session.role !== "SUPER_ADMIN")) {
      return { ok: false, error: "ไม่มีสิทธิ์อัปโหลดของร้านนี้" };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    assertSafeStorageId(businessId, "ร้าน");
    const sniffed = sniffImage(bytes);
    const rel = `/uploads/${businessId}/${newId()}.${sniffed.ext}`;
    const dest = path.join(process.cwd(), "public", rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
    return { ok: true, data: { url: rel } };
  } catch (error) {
    return fail(error);
  }
}

export async function saveOpsSettingsAction(
  businessId: string,
  raw: unknown,
): Promise<OpsResult> {
  const parsed = opsSettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลตั้งค่าไม่ครบ" };
  try {
    const { defaultDepositPercent, ...ops } = parsed.data;
    await getStore().updateSettings(await actor(), businessId, {
      defaultDepositPercent: defaultDepositPercent ?? null,
      ops: {
        minAdvanceHours: ops.minAdvanceHours,
        serviceHours: ops.serviceHours,
        cancellationPolicy: ops.cancellationPolicy,
        customerInstructions: ops.customerInstructions,
        overtimeNote: ops.overtimeNote,
        includedHoursPerDay: ops.includedHoursPerDay ?? null,
        overtimeRatePerHour: ops.overtimeRatePerHour ?? null,
        bankName: ops.bankName,
        bankAccountName: ops.bankAccountName,
        bankAccountNumber: ops.bankAccountNumber,
        promptpay: ops.promptpay,
        quotationPrefix: ops.quotationPrefix,
        taxInvoiceName: ops.taxInvoiceName,
        taxId: ops.taxId,
      },
    });
    revalidatePath("/store/settings");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function savePlaceAction(
  businessId: string,
  raw: unknown,
): Promise<OpsResult<{ id: string }>> {
  const parsed = placeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "ข้อมูลสถานที่ไม่ครบ" };
  try {
    const place = await getStore().upsertPlace(await actor(), businessId, parsed.data);
    revalidatePath("/store/places");
    return { ok: true, data: { id: place.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function setPlaceActiveAction(placeId: string, active: boolean): Promise<OpsResult> {
  try {
    await getStore().setPlaceActive(await actor(), placeId, active);
    revalidatePath("/store/places");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function archivePlaceAction(placeId: string): Promise<OpsResult> {
  try {
    await getStore().archivePlace(await actor(), placeId);
    revalidatePath("/store/places");
    revalidatePath("/s");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function searchOpsAction(businessId: string, query: string) {
  try {
    return { ok: true as const, data: await getStore().searchOps(await actor(), businessId, query) };
  } catch (error) {
    return { ...fail(error), data: searchBoard("", { bookings: [], customers: [], vehicles: [], drivers: [] }) };
  }
}

export async function listNotificationsAction(businessId: string) {
  try {
    const store = getStore();
    const me = await actor();
    const bookings = await store.listBookings(me, businessId);
    const [proofs, quotations, dayLogs, suggestions, reads] = await Promise.all([
      store.listPaymentProofs(me, businessId),
      store.listQuotations(me, businessId),
      store.listDriverDayLogs(me, businessId),
      store.listDriverRouteSuggestions(me, businessId),
      store.listNotificationReads(me, businessId),
    ]);
    return {
      ok: true as const,
      data: deriveNotifications({
        bookings,
        proofs,
        quotations,
        dayLogs,
        suggestions,
        readIds: reads.map((item) => item.notificationId),
      }),
    };
  } catch (error) {
    return { ...fail(error), data: [] };
  }
}

export async function markNotificationReadAction(businessId: string, notificationId: string) {
  try {
    await getStore().markNotificationRead(await actor(), businessId, notificationId);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function markAllNotificationsReadAction(
  businessId: string,
  notificationIds: string[],
) {
  try {
    await getStore().markAllNotificationsRead(await actor(), businessId, notificationIds);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
