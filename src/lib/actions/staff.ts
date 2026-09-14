"use server";

import { revalidatePath } from "next/cache";
import { actorFromSession, getSession, setSession } from "@/lib/auth/session";
import { DomainError, ConflictError, TenantIsolationError, getStore } from "@/lib/data";
import {
  STORE_STAFF_ROLES,
  type StorePermission,
  type StoreStaffRole,
} from "@/lib/domain/staff-permissions";

export type StaffActionResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string };

async function requireStoreActor() {
  const session = await getSession();
  if (!session) throw new TenantIsolationError("กรุณาเข้าสู่ระบบ");
  if (session.role === "CUSTOMER") throw new TenantIsolationError("ไม่มีสิทธิ์");
  return { actor: actorFromSession(session), session };
}

export async function inviteStaffAction(
  businessId: string,
  input: {
    fullName: string;
    email: string;
    phone?: string | null;
    staffRole: StoreStaffRole;
    permissions?: StorePermission[] | null;
  },
): Promise<StaffActionResult> {
  if (!STORE_STAFF_ROLES.includes(input.staffRole)) {
    return { ok: false, error: "บทบาทไม่ถูกต้อง" };
  }
  try {
    const { actor } = await requireStoreActor();
    // businessId must be authorized server-side via assertBusinessAccess
    const result = await getStore().inviteStaff(actor, businessId, input);
    revalidatePath("/store/settings");
    return {
      ok: true,
      data: {
        invitationId: result.invitation.id,
        inviteUrl: result.inviteUrl,
        rawToken: result.rawToken,
      },
    };
  } catch (error) {
    return mapError(error, "เชิญพนักงานไม่สำเร็จ");
  }
}

export async function revokeStaffInviteAction(
  businessId: string,
  invitationId: string,
): Promise<StaffActionResult> {
  try {
    const { actor } = await requireStoreActor();
    await getStore().revokeStaffInvite(actor, businessId, invitationId);
    revalidatePath("/store/settings");
    return { ok: true };
  } catch (error) {
    return mapError(error, "ยกเลิกคำเชิญไม่สำเร็จ");
  }
}

export async function updateStaffMemberAction(
  businessId: string,
  membershipId: string,
  input: {
    staffRole?: StoreStaffRole;
    permissions?: StorePermission[] | null;
    active?: boolean;
  },
): Promise<StaffActionResult> {
  try {
    const { actor } = await requireStoreActor();
    await getStore().updateStaffMember(actor, businessId, membershipId, input);
    revalidatePath("/store/settings");
    return { ok: true };
  } catch (error) {
    return mapError(error, "อัปเดตพนักงานไม่สำเร็จ");
  }
}

export async function removeStaffMemberAction(
  businessId: string,
  membershipId: string,
): Promise<StaffActionResult> {
  try {
    const { actor } = await requireStoreActor();
    await getStore().removeStaffMember(actor, businessId, membershipId);
    revalidatePath("/store/settings");
    return { ok: true };
  } catch (error) {
    return mapError(error, "ลบพนักงานไม่สำเร็จ");
  }
}

export async function acceptStaffInviteAction(input: {
  token: string;
  password: string;
  confirmPassword: string;
  fullName?: string | null;
}): Promise<StaffActionResult> {
  if (input.password !== input.confirmPassword) {
    return { ok: false, error: "รหัสผ่านไม่ตรงกัน" };
  }
  try {
    const result = await getStore().acceptStaffInvite({
      token: input.token,
      password: input.password,
      fullName: input.fullName,
    });
    await setSession({
      userId: result.profile.id,
      email: result.profile.email,
      role: result.profile.role,
      businessIds: [result.businessId],
      exp: Date.now() + 60 * 60 * 12 * 1000,
    });
    revalidatePath("/store");
    return { ok: true, data: { businessId: result.businessId } };
  } catch (error) {
    return mapError(error, "เข้าร่วมร้านไม่สำเร็จ");
  }
}

function mapError(error: unknown, fallback: string): StaffActionResult {
  if (
    error instanceof DomainError ||
    error instanceof ConflictError ||
    error instanceof TenantIsolationError
  ) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: fallback };
}
