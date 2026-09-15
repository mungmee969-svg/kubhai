import Link from "next/link";
import { PlatformAdminShell } from "@/components/admin/PlatformAdminShell";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { formatPlanPriceThb } from "@/lib/domain/saas-plans";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ctx = await requirePlatformAdmin();
  const [businesses, dashboard, awaiting] = await Promise.all([
    ctx.store.listBusinesses(ctx.actor),
    ctx.store.getPlatformSaasDashboard(ctx.actor),
    ctx.store.listPlatformSaasProofs(ctx.actor, "AWAITING_REVIEW"),
  ]);

  return (
    <PlatformAdminShell>
      <h1 className="text-2xl font-semibold">Platform Dashboard</h1>
      <p className="mt-2 text-sm text-white/60">
        ตัวเลขด้านล่างมาจาก SaaS subscription/payment เท่านั้น ไม่รวมเงินจองลูกค้า
      </p>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["ร้านทั้งหมด", dashboard.totalStores],
          ["Subscription ใช้งาน", dashboard.activeSubscriptions],
          ["รอตรวจสลิป", dashboard.awaitingReview],
          ["เกินกำหนด", dashboard.overdueSubscriptions],
          ["รายได้ SaaS เดือนนี้", formatPlanPriceThb(dashboard.revenueThisMonthThb)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-white/60">{label}</p>
            <p className="mt-2 text-xl font-semibold">{value}</p>
          </article>
        ))}
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-white/5 p-5">
          <div className="flex justify-between gap-3">
            <h2 className="font-semibold">Plan distribution</h2>
            <Link href="/admin/stores" className="text-xs text-accent">ดูร้านทั้งหมด →</Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {(["starter", "pro", "business"] as const).map((plan) => (
              <div key={plan} className="rounded-xl bg-white/5 p-3">
                <p className="text-xs uppercase text-white/60">{plan}</p>
                <p className="mt-1 text-lg font-semibold">
                  {dashboard.planDistribution[plan]}
                </p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-3xl bg-white/5 p-5">
          <div className="flex justify-between gap-3">
            <h2 className="font-semibold">รอตรวจหลักฐาน</h2>
            <Link href="/admin/saas-payments" className="text-xs text-accent">เปิดคิว →</Link>
          </div>
          <p className="mt-4 text-3xl font-semibold">{awaiting.length}</p>
        </article>
      </section>
      <section className="mt-6 rounded-3xl bg-white/5 p-5">
        <h2 className="font-semibold">ร้านล่าสุด</h2>
        <div className="mt-3 space-y-2">
          {businesses.slice(-5).reverse().map((business) => (
            <Link
              key={business.id}
              href={`/admin/stores/${business.id}`}
              className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
            >
              <span>{business.name}</span>
              <span className="text-xs text-white/60">{business.subscriptionPlan}</span>
            </Link>
          ))}
        </div>
      </section>
    </PlatformAdminShell>
  );
}
