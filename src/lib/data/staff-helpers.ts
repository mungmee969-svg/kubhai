import { createHash } from "node:crypto";
import { newId, newSecureToken } from "@/lib/domain/ids";
import {
  legacyRoleFromStaffRole,
  permissionsForRole,
  staffRoleFromLegacy,
  STORE_PERMISSIONS,
  type StorePermission,
  type StoreStaffRole,
} from "@/lib/domain/staff-permissions";
import type { Actor, BusinessUser, Profile, StaffInvitation, StaffMember } from "@/lib/domain/types";

export const STAFF_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(`kubhai-invite:${token}`).digest("hex");
}

export function normalizeBusinessUser(item: BusinessUser): BusinessUser {
  const staffRole = staffRoleFromLegacy(item.role, item.staffRole);
  const permissions =
    item.permissions?.length > 0
      ? item.permissions.filter((p) => STORE_PERMISSIONS.includes(p))
      : permissionsForRole(staffRole);
  return {
    ...item,
    staffRole,
    permissions,
    phone: item.phone ?? null,
    lastLoginAt: item.lastLoginAt ?? null,
  };
}

export function membershipPermissions(
  actor: Actor,
  businessUsers: BusinessUser[],
  businessId: string,
): StorePermission[] | "SUPER" | null {
  if (actor.kind !== "user") return null;
  if (actor.role === "SUPER_ADMIN") return "SUPER";
  const link = businessUsers.find(
    (item) => item.businessId === businessId && item.userId === actor.userId && item.active,
  );
  if (!link) return null;
  const normalized = normalizeBusinessUser(link);
  if (normalized.staffRole === "OWNER") return [...STORE_PERMISSIONS];
  return normalized.permissions;
}

export function actorHasPermission(
  actor: Actor,
  businessUsers: BusinessUser[],
  businessId: string,
  permission: StorePermission,
): boolean {
  const perms = membershipPermissions(actor, businessUsers, businessId);
  if (perms === "SUPER") return true;
  if (!perms) return false;
  return perms.includes(permission);
}

export function buildStaffDirectory(
  businessId: string,
  businessUsers: BusinessUser[],
  profiles: Profile[],
  invitations: StaffInvitation[],
): StaffMember[] {
  const members: StaffMember[] = businessUsers
    .filter((item) => item.businessId === businessId)
    .map((link) => {
      const normalized = normalizeBusinessUser(link);
      const profile = profiles.find((item) => item.id === link.userId);
      return {
        userId: link.userId,
        membershipId: link.id,
        email: profile?.email ?? "",
        fullName: profile?.fullName ?? "ไม่ทราบชื่อ",
        phone: normalized.phone,
        role: link.role,
        staffRole: normalized.staffRole,
        permissions: normalized.permissions,
        active: link.active && (profile?.active ?? false),
        status: link.active && (profile?.active ?? false) ? "ACTIVE" : "SUSPENDED",
        lastLoginAt: normalized.lastLoginAt,
        invitationId: null,
      };
    });

  for (const invite of invitations.filter(
    (item) =>
      item.businessId === businessId && !item.acceptedAt && !item.revokedAt && Date.parse(item.expiresAt) > Date.now(),
  )) {
    members.push({
      userId: invite.id,
      membershipId: invite.id,
      email: invite.email,
      fullName: invite.fullName,
      phone: invite.phone,
      role: legacyRoleFromStaffRole(invite.staffRole),
      staffRole: invite.staffRole,
      permissions: invite.permissions,
      active: false,
      status: "PENDING_INVITE",
      lastLoginAt: null,
      invitationId: invite.id,
    });
  }

  return members.sort((a, b) => a.fullName.localeCompare(b.fullName, "th"));
}

export function createInvitationRecord(input: {
  businessId: string;
  email: string;
  phone: string | null;
  fullName: string;
  staffRole: StoreStaffRole;
  permissions: StorePermission[];
  invitedByUserId: string;
  now?: string;
}): { invitation: StaffInvitation; rawToken: string } {
  const rawToken = newSecureToken();
  const now = input.now ?? new Date().toISOString();
  const invitation: StaffInvitation = {
    id: newId(),
    businessId: input.businessId,
    email: input.email.trim().toLowerCase(),
    phone: input.phone,
    fullName: input.fullName.trim(),
    staffRole: input.staffRole,
    permissions: input.permissions,
    tokenHash: hashInviteToken(rawToken),
    expiresAt: new Date(Date.parse(now) + STAFF_INVITE_TTL_MS).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    invitedByUserId: input.invitedByUserId,
    createdAt: now,
  };
  return { invitation, rawToken };
}
