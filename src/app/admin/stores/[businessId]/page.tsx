import { notFound } from "next/navigation";
import { PlatformAdminShell } from "@/components/admin/PlatformAdminShell";
import {
  issueSaasBillingPeriodAction,
  updateSaasSubscriptionAction,
} from "@/lib/actions/saas-billing";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { capabilityLabelsForPlan, formatPlanPriceThb } from "@/lib/domain/saas-plans";

export const dynamic = "force-dynamic";

export default async function PlatformStoreDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const ctx = await requirePlatformAdmin();
  const business = (await ctx.store.listBusinesses(ctx.actor)).find(
    (item) => item.id === businessId,
  );
  if (!business) notFound();
  const [billing, board] = await Promise.all([
    ctx.store.getSaasBillingAccount(ctx.actor, business.id),
    ctx.store.loadTenantBoard(ctx.actor, business.id),
  ]);
  const owner = board.staff.find((item) => item.staffRole === "OWNER");
  const subscription = billing.subscription;
  const hasOpenBill = billing.billingPeriods.some((item) =>
    ["PENDING", "AWAITING_REVIEW", "REJECTED", "OVERDUE"].includes(item.status),
  );
  const suggestedStart = (
    subscription?.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : new Date()
  )
    .toISOString()
    .slice(0, 10);
  const date = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString("th-TH") : "—";

  return (
    <PlatformAdminShell>
      <h1 className="text-2xl font-semibold">{business.name}</h1>
      <p className="mt-1 text-sm text-white/60">/{business.slug} · {business.id}</p>
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-white/5 p-5">
          <h2 className="font-semibold">Store profile</h2>
          <div className="mt-3 space-y-1 text-sm text-white/70">
            <p>Owner: {owner?.fullName ?? "—"} · {owner?.email ?? "—"}</p>
            <p>สถานะร้าน: {business.status}</p>
            <p>สร้างเมื่อ: {date(business.createdAt)}</p>
            <p>Plan ใน Business: {business.subscriptionPlan ?? "—"}</p>
          </div>
        </article>
        <article className="rounded-3xl bg-white/5 p-5">
          <h2 className="font-semibold">Subscription</h2>
          {subscription ? (
            <div className="mt-3 space-y-1 text-sm text-white/70">
              <p>Plan: {subscription.planId}</p>
              <p>สถานะ: {subscription.status}</p>
              <p>รอบปัจจุบัน: {date(subscription.currentPeriodStart)} – {date(subscription.currentPeriodEnd)}</p>
              <p>ครบกำหนดถัดไป: {date(subscription.nextDueAt)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/60">ยังไม่มี Subscription ที่บันทึกจริง</p>
          )}
        </article>
      </section>

      {subscription ? (
        <form action={updateSaasSubscriptionAction} className="mt-5 grid gap-3 rounded-3xl bg-white/5 p-5 md:grid-cols-2">
          <input type="hidden" name="subscriptionId" value={subscription.id} />
          <h2 className="md:col-span-2 font-semibold">แก้ไข Subscription แบบมี Audit</h2>
          <select name="planId" defaultValue={subscription.planId} className="rounded-xl bg-white px-3 py-2 text-sm text-navy-950">
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
          <select name="status" defaultValue={subscription.status} className="rounded-xl bg-white px-3 py-2 text-sm text-navy-950">
            <option value="PENDING_PAYMENT">รอชำระ</option>
            <option value="ACTIVE">ใช้งาน</option>
            <option value="PAST_DUE">เกินกำหนด</option>
            <option value="SUSPENDED">ระงับ</option>
            <option value="CANCELLED">ยกเลิก</option>
          </select>
          <label className="text-sm text-white/70">
            แก้ไขวันสิ้นสุด (ถ้าจำเป็น)
            <input name="extendUntil" type="datetime-local" className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-navy-950" />
          </label>
          <label className="text-sm text-white/70">
            เหตุผล (บังคับ)
            <input name="reason" required className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-navy-950" />
          </label>
          <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-navy-950 md:col-span-2">
            บันทึกการเปลี่ยนแปลง
          </button>
        </form>
      ) : null}

      {!hasOpenBill ? (
        <form action={issueSaasBillingPeriodAction} className="mt-5 grid gap-3 rounded-3xl bg-white/5 p-5 md:grid-cols-2">
          <input type="hidden" name="businessId" value={business.id} />
          <h2 className="font-semibold md:col-span-2">ออกรอบบิล SaaS</h2>
          <select name="planId" defaultValue={subscription?.planId ?? "starter"} className="rounded-xl bg-white px-3 py-2 text-sm text-navy-950">
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
          <label className="text-sm text-white/70">
            เริ่มรอบบริการ
            <input name="periodStart" type="date" defaultValue={suggestedStart} required className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-navy-950" />
          </label>
          <label className="text-sm text-white/70">
            วันครบกำหนด
            <input name="dueAt" type="date" defaultValue={suggestedStart} required className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-navy-950" />
          </label>
          <label className="text-sm text-white/70">
            เหตุผล (บังคับ)
            <input name="reason" required className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-navy-950" />
          </label>
          <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-navy-950 md:col-span-2">
            ออกรอบบิลตามข้อมูลนี้
          </button>
        </form>
      ) : null}

      <section className="mt-5 rounded-3xl bg-white/5 p-5">
        <h2 className="font-semibold">Entitlements</h2>
        <ul className="mt-3 grid gap-1 text-sm text-white/70 sm:grid-cols-2">
          {capabilityLabelsForPlan(subscription?.planId ?? business.subscriptionPlan).map((label) => (
            <li key={label}>• {label}</li>
          ))}
        </ul>
      </section>

      <section className="mt-5 rounded-3xl bg-white/5 p-5">
        <h2 className="font-semibold">Billing periods</h2>
        <div className="mt-3 space-y-2">
          {billing.billingPeriods.map((period) => (
            <article key={period.id} className="rounded-xl bg-white/5 p-3 text-sm">
              <p className="font-medium">{period.planNameSnapshot} · {formatPlanPriceThb(period.amountThb)} · {period.status}</p>
              <p className="text-xs text-white/60">{date(period.periodStart)} – {date(period.periodEnd)} · due {date(period.dueAt)}</p>
            </article>
          ))}
          {!billing.billingPeriods.length ? <p className="text-sm text-white/60">ไม่มีข้อมูล</p> : null}
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-white/5 p-5">
        <h2 className="font-semibold">SaaS payments / proofs</h2>
        <div className="mt-3 space-y-3">
          {billing.paymentProofs.map((proof) => (
            <article key={proof.id} className="grid gap-3 rounded-xl bg-white/5 p-3 sm:grid-cols-[120px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof.imageDataUrl} alt="หลักฐานชำระ SaaS" className="h-28 w-28 rounded-lg object-cover" />
              <div className="text-sm text-white/70">
                <p className="font-medium text-white">{proof.status} · {formatPlanPriceThb(proof.submittedAmountThb)}</p>
                <p>ส่ง {date(proof.submittedAt)} · ตรวจ {date(proof.reviewedAt)}</p>
                <p>Expected {formatPlanPriceThb(proof.expectedAmountThb)}</p>
                <p>Provider verification: {proof.providerVerificationResult ? "มีข้อมูล" : "ไม่ได้ตั้งค่า"}</p>
                {proof.duplicateOfProofId ? <p className="text-warning">อาจซ้ำกับ {proof.duplicateOfProofId}</p> : null}
                {proof.rejectionReason ? <p className="text-danger">{proof.rejectionReason}</p> : null}
              </div>
            </article>
          ))}
          {!billing.paymentProofs.length ? <p className="text-sm text-white/60">ไม่มีข้อมูล</p> : null}
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-white/5 p-5">
        <h2 className="font-semibold">Subscription audit</h2>
        <div className="mt-3 space-y-2 text-xs text-white/65">
          {billing.auditLogs.map((entry) => (
            <p key={entry.id}>{date(entry.createdAt)} · {entry.action} · {entry.actorUserId ?? "system"}</p>
          ))}
          {!billing.auditLogs.length ? <p>ไม่มีข้อมูล</p> : null}
        </div>
      </section>
    </PlatformAdminShell>
  );
}
