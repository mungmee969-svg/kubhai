"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession, getSession } from "@/lib/auth/session";
import {
  ConflictError,
  DomainError,
  TenantIsolationError,
  getStore,
} from "@/lib/data";
import {
  TRIP_PACKAGE_STATUSES,
  type TripPackageStatus,
  type TripPackageUpdateInput,
  type TripPackageWriteInput,
} from "@/lib/domain/trip-package";

export type TripPackageActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireActor() {
  const session = await getSession();
  if (!session) throw new TenantIsolationError("กรุณาเข้าสู่ระบบ");
  return actorFromSession(session);
}

function fail(error: unknown): TripPackageActionResult<never> {
  if (
    error instanceof DomainError ||
    error instanceof ConflictError ||
    error instanceof TenantIsolationError
  ) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "ดำเนินการไม่สำเร็จ" };
}

async function revalidateTripPackagePaths(businessId: string, packageId?: string) {
  revalidatePath("/store");
  revalidatePath("/store/packages");
  revalidatePath("/store/trip-packages");
  if (packageId) {
    revalidatePath(`/store/packages/${packageId}`);
    revalidatePath(`/store/trip-packages/${packageId}`);
  }
  try {
    const actor = await requireActor();
    const businesses = await getStore().listBusinesses(actor);
    const slug = businesses.find((item) => item.id === businessId)?.slug;
    if (slug) {
      revalidatePath(`/s/${slug}`);
      revalidatePath(`/s/${slug}/packages`);
      if (packageId) revalidatePath(`/s/${slug}/packages/${packageId}`);
    }
  } catch {
    // Revalidation of storefront is best-effort when session context is thin.
  }
}

export async function createTripPackageAction(
  businessId: string,
  input: TripPackageWriteInput,
): Promise<TripPackageActionResult<{ id: string }>> {
  try {
    const pkg = await getStore().createTripPackage(await requireActor(), businessId, input);
    await revalidateTripPackagePaths(businessId, pkg.id);
    return { ok: true, data: { id: pkg.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTripPackageAction(
  id: string,
  input: TripPackageUpdateInput,
): Promise<TripPackageActionResult<{ id: string }>> {
  try {
    const actor = await requireActor();
    const pkg = await getStore().updateTripPackage(actor, id, input);
    await revalidateTripPackagePaths(pkg.businessId, pkg.id);
    return { ok: true, data: { id: pkg.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function setTripPackageStatusAction(
  id: string,
  status: TripPackageStatus,
): Promise<TripPackageActionResult> {
  if (!TRIP_PACKAGE_STATUSES.includes(status)) {
    return { ok: false, error: "สถานะไม่ถูกต้อง" };
  }
  try {
    const pkg = await getStore().setTripPackageStatus(await requireActor(), id, status);
    await revalidateTripPackagePaths(pkg.businessId, pkg.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function publishTripPackageAction(id: string): Promise<TripPackageActionResult> {
  try {
    const pkg = await getStore().publishTripPackage(await requireActor(), id);
    await revalidateTripPackagePaths(pkg.businessId, pkg.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function unpublishTripPackageAction(id: string): Promise<TripPackageActionResult> {
  try {
    const pkg = await getStore().unpublishTripPackage(await requireActor(), id);
    await revalidateTripPackagePaths(pkg.businessId, pkg.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveTripPackageAction(id: string): Promise<TripPackageActionResult> {
  try {
    const pkg = await getStore().archiveTripPackage(await requireActor(), id);
    await revalidateTripPackagePaths(pkg.businessId, pkg.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
