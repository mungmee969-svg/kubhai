import Link from "next/link";
import { PlatformAdminShell } from "@/components/admin/PlatformAdminShell";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; status?: string }>;
}) {
  const ctx = await requirePlatformAdmin();
  const query = await searchParams;
  const businesses = await ctx.store.listBusinesses(ctx.actor);
  const rows = await Promise.all(
    businesses.map(async (business) => {
      const [billing, board] = await Promise.all([
        ctx.store.getSaasBillingAccount(ctx.actor, business.id),
        ctx.store.loadTenantBoard(ctx.actor, business.id),
      ]);
      return {
        business,
        billing,
        owner: board.staff.find((item) => item.staffRole === "OWNER") ?? null,
      };
    }),
  );
  const q = query.q?.trim().toLowerCase() ?? "";
  const filtered = rows.filter(({ business, billing, owner }) => {
    const matchesText =
      !q ||
      business.name.toLowerCase().includes(q) ||
      business.slug.toLowerCase().includes(q) ||
      owner?.email.toLowerCase().includes(q);
    const matchesPlan =
      !query.plan || billing.subscription?.planId === query.plan;
    const matchesStatus =
      !query.status || billing.subscription?.status === query.status;
    return matchesText && matchesPlan && matchesStatus;
  });
  const date = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleDateString("th-TH") : "—";

  return (
    <PlatformAdminShell>
      <h1 className="text-2xl font-semibold">Stores</h1>
      <form className="mt-5 grid gap-2 rounded-2xl bg-white/5 p-4 md:grid-cols-[1fr_180px_180px_auto]">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="ชื่อร้าน, slug, owner"
          className="rounded-xl bg-white px-3 py-2 text-sm text-navy-950"
        />
        <select name="plan" defaultValue={query.plan ?? ""} className="rounded-xl bg-white px-3 py-2 text-sm text-navy-950">
          <option value="">ทุกแพ็กเกจ</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <select name="status" defaultValue={query.status ?? ""} className="rounded-xl bg-white px-3 py-2 text-sm text-navy-950">
          <option value="">ทุกสถานะ</option>
          <option value="PENDING_PAYMENT">รอชำระ</option>
          <option value="ACTIVE">ใช้งาน</option>
          <option value="PAST_DUE">เกินกำหนด</option>
          <option value="SUSPENDED">ระงับ</option>
          <option value="CANCELLED">ยกเลิก</option>
        </select>
        <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-navy-950">ค้นหา</button>
      </form>
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white/5">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="text-xs text-white/60">
            <tr>
              <th className="p-3">ร้าน</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Subscription</th>
              <th className="p-3">Billing</th>
              <th className="p-3">สิ้นสุด</th>
              <th className="p-3">สร้างเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ business, billing, owner }) => (
              <tr key={business.id} className="border-t border-white/10">
                <td className="p-3">
                  <Link href={`/admin/stores/${business.id}`} className="font-semibold text-accent">
                    {business.name}
                  </Link>
                  <p className="text-xs text-white/50">/{business.slug}</p>
                </td>
                <td className="p-3">{owner?.email ?? "—"}</td>
                <td className="p-3">{billing.subscription?.planId ?? business.subscriptionPlan ?? "—"}</td>
                <td className="p-3">{billing.subscription?.status ?? "ยังไม่มี"}</td>
                <td className="p-3">{billing.billingPeriods[0]?.status ?? "ยังไม่มี"}</td>
                <td className="p-3">{date(billing.subscription?.currentPeriodEnd)}</td>
                <td className="p-3">{date(business.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformAdminShell>
  );
}
