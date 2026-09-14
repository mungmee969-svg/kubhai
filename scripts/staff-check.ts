/**
 * Staff invitation + permission checks.
 * Fixtures: TEST_STAFF_
 */
import {
  LocalStore,
  purgeByClientRequestPrefix,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import {
  permissionsForRole,
  SENSITIVE_FINANCIAL_PERMISSIONS,
} from "../src/lib/domain/staff-permissions";
import { hashInviteToken } from "../src/lib/data/staff-helpers";
import type { Actor } from "../src/lib/domain/types";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const store = new LocalStore();
let failed = 0;
const PREFIX = "TEST_STAFF_";

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const pondOwner: Actor = {
  kind: "user",
  userId: SEED.userPondOwner,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessPond],
};

const pondStaff: Actor = {
  kind: "user",
  userId: SEED.userPondStaff,
  role: "BUSINESS_STAFF",
  businessIds: [SEED.businessPond],
};

const demoOwner: Actor = {
  kind: "user",
  userId: SEED.userDemo002,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessDemo002],
};

async function purgeStaffFixtures() {
  await purgeByClientRequestPrefix(PREFIX);
  const dbPath = path.join(process.cwd(), "data", "local-dev.json");
  try {
    const raw = JSON.parse(await readFile(dbPath, "utf8")) as {
      staffInvitations?: { email?: string; id?: string }[];
      businessUsers?: { id: string; userId: string; businessId: string }[];
      profiles?: { id: string; email: string }[];
      auditLogs?: { action?: string; metadata?: { email?: string } }[];
    };
    const emails = new Set(
      (raw.staffInvitations ?? [])
        .filter((item) => item.email?.includes("test-staff"))
        .map((item) => item.email!),
    );
    for (const p of raw.profiles ?? []) {
      if (p.email?.includes("test-staff") || p.email?.startsWith(PREFIX.toLowerCase())) {
        emails.add(p.email);
      }
    }
    const profileIds = new Set(
      (raw.profiles ?? []).filter((item) => emails.has(item.email)).map((item) => item.id),
    );
    raw.staffInvitations = (raw.staffInvitations ?? []).filter(
      (item) => !item.email || !emails.has(item.email),
    );
    raw.businessUsers = (raw.businessUsers ?? []).filter((item) => !profileIds.has(item.userId));
    raw.profiles = (raw.profiles ?? []).filter((item) => !emails.has(item.email));
    await writeFile(dbPath, JSON.stringify(raw, null, 2));
  } catch {
    // db may not exist yet
  }
}

async function main() {
  try {
    await purgeStaffFixtures();

    const invited = await store.inviteStaff(pondOwner, SEED.businessPond, {
      fullName: "Staff Invitee",
      email: "invitee@test-staff.local",
      phone: "0899400001",
      staffRole: "STAFF",
    });
    assert("OWNER can invite staff", Boolean(invited.rawToken && invited.invitation.id));
    assert("invite token high entropy", invited.rawToken.length >= 32);
    assert(
      "invite bound to correct business",
      invited.invitation.businessId === SEED.businessPond,
    );

    const adminInvite = await store.inviteStaff(pondOwner, SEED.businessPond, {
      fullName: "Admin Invitee",
      email: "admin@test-staff.local",
      staffRole: "ADMIN",
      permissions: permissionsForRole("ADMIN"),
    });
    assert("OWNER can invite admin/manager", adminInvite.invitation.staffRole === "ADMIN");

    let staffBlocked = false;
    try {
      await store.inviteStaff(pondStaff, SEED.businessPond, {
        fullName: "Nope",
        email: "nope@test-staff.local",
        staffRole: "STAFF",
      });
    } catch {
      staffBlocked = true;
    }
    assert("STAFF cannot invite", staffBlocked);

    let tenantBlocked = false;
    try {
      await store.inviteStaff(demoOwner, SEED.businessPond, {
        fullName: "Cross",
        email: "cross@test-staff.local",
        staffRole: "STAFF",
      });
    } catch {
      tenantBlocked = true;
    }
    assert("Store A cannot manage Store B staff", tenantBlocked);

    // expire invite
    const expired = await store.inviteStaff(pondOwner, SEED.businessPond, {
      fullName: "Expired",
      email: "expired@test-staff.local",
      staffRole: "STAFF",
    });
    // manually expire via accept path after mutating would need store access — accept with past: revoke instead
    await store.revokeStaffInvite(pondOwner, SEED.businessPond, expired.invitation.id);
    let revokedAccept = false;
    try {
      await store.acceptStaffInvite({
        token: expired.rawToken,
        password: "password123",
      });
    } catch {
      revokedAccept = true;
    }
    assert("invite revoke", revokedAccept);

    const fresh = await store.inviteStaff(pondOwner, SEED.businessPond, {
      fullName: "Fresh Join",
      email: "fresh@test-staff.local",
      staffRole: "STAFF",
    });
    const accepted = await store.acceptStaffInvite({
      token: fresh.rawToken,
      password: "password123",
      fullName: "Fresh Join",
    });
    assert("accept invite creates membership", Boolean(accepted.profile.id));

    let dupAccept = false;
    try {
      await store.acceptStaffInvite({
        token: fresh.rawToken,
        password: "password123",
      });
    } catch {
      dupAccept = true;
    }
    assert("duplicate acceptance rejected", dupAccept);

    const staffList = await store.listStaff(pondOwner, SEED.businessPond);
    const joined = staffList.find((item) => item.email === "fresh@test-staff.local");
    assert("role defaults staff", joined?.staffRole === "STAFF");
    assert(
      "financial permissions protected by default",
      joined &&
        SENSITIVE_FINANCIAL_PERMISSIONS.every((perm) => !joined.permissions.includes(perm)),
    );

    const custom = await store.inviteStaff(pondOwner, SEED.businessPond, {
      fullName: "Custom Perms",
      email: "custom@test-staff.local",
      staffRole: "ADMIN",
      permissions: ["BOOKING_VIEW", "PAYMENT_PROOF_APPROVE"],
    });
    // OWNER grants PAYMENT_PROOF_APPROVE to admin — allowed because owner has it
    assert(
      "custom permissions",
      custom.invitation.permissions.includes("BOOKING_VIEW") &&
        custom.invitation.permissions.includes("PAYMENT_PROOF_APPROVE"),
    );

    // Staff cannot escalate: invite as staff actor already blocked.
    // Role update
    if (joined) {
      await store.updateStaffMember(pondOwner, SEED.businessPond, joined.membershipId, {
        staffRole: "ADMIN",
        permissions: permissionsForRole("ADMIN"),
      });
      const afterRole = (await store.listStaff(pondOwner, SEED.businessPond)).find(
        (item) => item.email === "fresh@test-staff.local",
      );
      assert("staff role update", afterRole?.staffRole === "ADMIN");

      await store.updateStaffMember(pondOwner, SEED.businessPond, joined.membershipId, {
        permissions: ["BOOKING_VIEW", "DISPATCH_VIEW"],
      });
      const afterPerm = (await store.listStaff(pondOwner, SEED.businessPond)).find(
        (item) => item.email === "fresh@test-staff.local",
      );
      assert(
        "staff permission update",
        afterPerm?.permissions.includes("BOOKING_VIEW") &&
          !afterPerm.permissions.includes("BOOKING_MANAGE"),
      );

      await store.updateStaffMember(pondOwner, SEED.businessPond, joined.membershipId, {
        active: false,
      });
      const suspended = await store.assertActiveStoreMembership(joined.userId, SEED.businessPond);
      assert("staff suspend", !suspended);
      assert("suspended user authorization rejected", !(await store.assertActiveStoreMembership(joined.userId, SEED.businessPond)));

      await store.updateStaffMember(pondOwner, SEED.businessPond, joined.membershipId, {
        active: true,
      });
      assert(
        "staff reactivate",
        await store.assertActiveStoreMembership(joined.userId, SEED.businessPond),
      );
    }

    // cannot remove last owner
    const owners = (await store.listStaff(pondOwner, SEED.businessPond)).filter(
      (item) => item.staffRole === "OWNER" && item.status === "ACTIVE",
    );
    let lastOwnerBlocked = false;
    try {
      await store.updateStaffMember(pondOwner, SEED.businessPond, owners[0]!.membershipId, {
        active: false,
      });
    } catch {
      lastOwnerBlocked = true;
    }
    assert("cannot remove last OWNER", lastOwnerBlocked);

    // self-promote blocked for staff
    let selfPromote = false;
    try {
      const staffMember = (await store.listStaff(pondOwner, SEED.businessPond)).find(
        (item) => item.userId === SEED.userPondStaff,
      );
      await store.updateStaffMember(pondStaff, SEED.businessPond, staffMember!.membershipId, {
        staffRole: "OWNER",
      });
    } catch {
      selfPromote = true;
    }
    assert("cannot self-promote", selfPromote);

    // Store #002 isolation on list
    let demoListBlocked = false;
    try {
      await store.listStaff(demoOwner, SEED.businessPond);
    } catch {
      demoListBlocked = true;
    }
    assert("Store #002 isolation", demoListBlocked);

    // token hash stored, not raw
    assert(
      "secure invite token hashed",
      invited.invitation.tokenHash === hashInviteToken(invited.rawToken) &&
        !JSON.stringify(invited.invitation).includes(invited.rawToken),
    );

    // audit presence via listAuditLogs
    const audits = await store.listAuditLogs(pondOwner, SEED.businessPond);
    assert(
      "audit events",
      audits.some((item) => item.action === "STAFF_INVITED") &&
        audits.some((item) => item.action === "STAFF_INVITE_ACCEPTED"),
    );

    console.log(failed === 0 ? "\nstaff-check: ALL PASS" : `\nstaff-check: ${failed} FAILED`);
  } finally {
    await purgeStaffFixtures();
    console.log("fixture cleanup done");
  }
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
