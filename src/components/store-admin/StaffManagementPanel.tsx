"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  inviteStaffAction,
  removeStaffMemberAction,
  revokeStaffInviteAction,
  updateStaffMemberAction,
} from "@/lib/actions/staff";
import {
  PERMISSION_GROUPS,
  STORE_PERMISSION_LABEL,
  STORE_STAFF_ROLE_LABEL,
  permissionsForRole,
  type StorePermission,
  type StoreStaffRole,
} from "@/lib/domain/staff-permissions";
import type { StaffMember } from "@/lib/domain/types";
import { Feedback } from "@/components/store-admin/ui/Feedback";

type Filter = "ALL" | "ACTIVE" | "PENDING_INVITE" | "SUSPENDED";

export function StaffManagementPanel({
  businessId,
  staff,
  canManage,
}: {
  businessId: string;
  staff: StaffMember[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<"invite" | "edit" | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffRole, setStaffRole] = useState<StoreStaffRole>("STAFF");
  const [permissions, setPermissions] = useState<StorePermission[]>(permissionsForRole("STAFF"));
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filtered = useMemo(() => {
    return staff.filter((member) => {
      if (filter === "ACTIVE" && member.status !== "ACTIVE") return false;
      if (filter === "PENDING_INVITE" && member.status !== "PENDING_INVITE") return false;
      if (filter === "SUSPENDED" && member.status !== "SUSPENDED") return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        member.fullName.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        (member.phone ?? "").includes(q)
      );
    });
  }, [staff, filter, query]);

  function openInvite() {
    setEditing(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setStaffRole("STAFF");
    setPermissions(permissionsForRole("STAFF"));
    setShowAdvanced(false);
    setInviteLink(null);
    setError(null);
    setDrawer("invite");
  }

  function openEdit(member: StaffMember) {
    if (member.status === "PENDING_INVITE") return;
    setEditing(member);
    setFullName(member.fullName);
    setEmail(member.email);
    setPhone(member.phone ?? "");
    setStaffRole(member.staffRole);
    setPermissions(member.permissions);
    setShowAdvanced(false);
    setInviteLink(null);
    setError(null);
    setDrawer("edit");
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await inviteStaffAction(businessId, {
      fullName,
      email,
      phone: phone || null,
      staffRole,
      permissions: showAdvanced ? permissions : null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const url = String(result.data?.inviteUrl ?? "");
    setInviteLink(typeof window !== "undefined" ? `${window.location.origin}${url}` : url);
    setSuccess("สร้างคำเชิญแล้ว — คัดลอกลิงก์ให้พนักงานตั้งรหัสผ่านเอง");
    router.refresh();
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !canManage) return;
    setPending(true);
    setError(null);
    const result = await updateStaffMemberAction(businessId, editing.membershipId, {
      staffRole,
      permissions: showAdvanced ? permissions : permissionsForRole(staffRole),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess("อัปเดตสิทธิ์แล้ว");
    setDrawer(null);
    router.refresh();
  }

  async function run(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    okMessage: string,
  ) {
    setPending(true);
    setError(null);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(okMessage);
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy-800">พนักงานและสิทธิ์การใช้งาน</h2>
          <p className="mt-1 text-sm text-muted">จัดการผู้ที่สามารถเข้าถึงระบบของร้าน</p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openInvite}
            className="h-10 rounded-xl bg-navy-800 px-4 text-sm font-semibold text-white"
          >
            + เพิ่มแอดมิน / พนักงาน
          </button>
        ) : null}
      </div>

      <Feedback error={error} success={success} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              ["ALL", "ทั้งหมด"],
              ["ACTIVE", "ใช้งาน"],
              ["PENDING_INVITE", "รอตอบรับ"],
              ["SUSPENDED", "ระงับ"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1.5 ${
                filter === id ? "bg-navy-800 text-white" : "bg-paper text-navy-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="admin-input sm:max-w-xs"
          placeholder="ค้นหา ชื่อ / อีเมล / เบอร์"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ul className="space-y-3">
        {filtered.map((member) => (
          <li key={`${member.membershipId}-${member.status}`} className="rounded-2xl bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-navy-800">{member.fullName}</p>
                <p className="truncate text-sm text-muted">{member.email}</p>
                {member.phone ? <p className="text-sm text-muted">{member.phone}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-paper px-2.5 py-1">
                    {STORE_STAFF_ROLE_LABEL[member.staffRole]}
                  </span>
                  <span className="rounded-full bg-paper px-2.5 py-1">
                    {member.status === "ACTIVE"
                      ? "ใช้งาน"
                      : member.status === "PENDING_INVITE"
                        ? "รอตอบรับคำเชิญ"
                        : "ระงับการใช้งาน"}
                  </span>
                  {member.lastLoginAt ? (
                    <span className="rounded-full bg-paper px-2.5 py-1">
                      เข้าสู่ระบบล่าสุด {new Date(member.lastLoginAt).toLocaleString("th-TH")}
                    </span>
                  ) : null}
                </div>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {member.status === "PENDING_INVITE" && member.invitationId ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="h-9 rounded-lg border border-line px-3 text-xs"
                      onClick={() =>
                        void run(
                          () => revokeStaffInviteAction(businessId, member.invitationId!),
                          "ยกเลิกคำเชิญแล้ว",
                        )
                      }
                    >
                      ยกเลิกคำเชิญ
                    </button>
                  ) : null}
                  {member.status !== "PENDING_INVITE" ? (
                    <button
                      type="button"
                      className="h-9 rounded-lg border border-line px-3 text-xs"
                      onClick={() => openEdit(member)}
                    >
                      แก้ไขสิทธิ์
                    </button>
                  ) : null}
                  {member.status === "ACTIVE" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="h-9 rounded-lg border border-line px-3 text-xs"
                      onClick={() =>
                        void run(
                          () =>
                            updateStaffMemberAction(businessId, member.membershipId, {
                              active: false,
                            }),
                          "ระงับการใช้งานแล้ว",
                        )
                      }
                    >
                      ระงับ
                    </button>
                  ) : null}
                  {member.status === "SUSPENDED" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="h-9 rounded-lg border border-line px-3 text-xs"
                      onClick={() =>
                        void run(
                          () =>
                            updateStaffMemberAction(businessId, member.membershipId, {
                              active: true,
                            }),
                          "เปิดใช้งานแล้ว",
                        )
                      }
                    >
                      เปิดใช้งาน
                    </button>
                  ) : null}
                  {member.status !== "PENDING_INVITE" && member.staffRole !== "OWNER" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="h-9 rounded-lg px-3 text-xs text-danger"
                      onClick={() =>
                        void run(
                          () => removeStaffMemberAction(businessId, member.membershipId),
                          "ลบออกจากร้านแล้ว",
                        )
                      }
                    >
                      ลบออกจากร้าน
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
        {!filtered.length ? (
          <li className="rounded-2xl bg-white p-6 text-center text-sm text-muted">ไม่พบพนักงาน</li>
        ) : null}
      </ul>

      <p className="text-xs text-muted">
        ระบบเชิญพนักงานใช้ลิงก์ปลอดภัย — ยังไม่ได้ต่ออีเมล/SMS จริงในสภาพแวดล้อมนี้
      </p>

      {drawer ? (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-navy-950/40" onClick={() => setDrawer(null)} />
          <aside className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-w-md md:rounded-none">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-navy-800">
                {drawer === "invite" ? "เพิ่มแอดมิน / พนักงาน" : "แก้ไขสิทธิ์"}
              </h3>
              <button type="button" className="text-sm text-muted" onClick={() => setDrawer(null)}>
                ปิด
              </button>
            </div>
            <form onSubmit={drawer === "invite" ? submitInvite : submitEdit} className="space-y-3">
              {drawer === "invite" ? (
                <>
                  <input
                    className="admin-input"
                    placeholder="ชื่อ"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                  <input
                    className="admin-input"
                    type="email"
                    placeholder="อีเมล"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className="admin-input"
                    placeholder="เบอร์โทร (ถ้ามี)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </>
              ) : (
                <p className="text-sm text-muted">
                  {editing?.fullName} · {editing?.email}
                </p>
              )}
              <label className="block space-y-1 text-sm">
                <span className="text-muted">บทบาท</span>
                <select
                  className="admin-input"
                  value={staffRole}
                  onChange={(e) => {
                    const next = e.target.value as StoreStaffRole;
                    setStaffRole(next);
                    setPermissions(permissionsForRole(next));
                  }}
                >
                  <option value="ADMIN">{STORE_STAFF_ROLE_LABEL.ADMIN}</option>
                  <option value="STAFF">{STORE_STAFF_ROLE_LABEL.STAFF}</option>
                  {drawer === "edit" ? (
                    <option value="OWNER">{STORE_STAFF_ROLE_LABEL.OWNER}</option>
                  ) : null}
                </select>
              </label>
              <button
                type="button"
                className="text-xs text-navy-800 underline"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "ซ่อนสิทธิ์ละเอียด" : "ปรับสิทธิ์ละเอียด"}
              </button>
              {showAdvanced ? (
                <div className="space-y-3 rounded-2xl bg-paper p-3">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="mb-1 text-xs font-semibold text-navy-800">{group.title}</p>
                      <div className="space-y-1">
                        {group.permissions.map((perm) => (
                          <label key={perm} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={permissions.includes(perm)}
                              onChange={(e) => {
                                setPermissions((current) =>
                                  e.target.checked
                                    ? [...current, perm]
                                    : current.filter((item) => item !== perm),
                                );
                              }}
                            />
                            {STORE_PERMISSION_LABEL[perm]}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="h-11 w-full rounded-xl bg-navy-800 text-sm font-semibold text-white disabled:opacity-60"
              >
                {drawer === "invite" ? "สร้างคำเชิญ" : "บันทึก"}
              </button>
              {inviteLink ? (
                <div className="space-y-2 rounded-2xl border border-line p-3">
                  <p className="text-xs text-muted">ลิงก์เชิญ (คัดลอกสำหรับทดสอบ)</p>
                  <p className="break-all text-xs">{inviteLink}</p>
                  <button
                    type="button"
                    className="h-9 w-full rounded-lg bg-paper text-xs font-semibold"
                    onClick={() => void navigator.clipboard.writeText(inviteLink)}
                  >
                    คัดลอกลิงก์เชิญ
                  </button>
                </div>
              ) : null}
            </form>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
