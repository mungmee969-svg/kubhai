import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStoreContext } from "@/lib/auth/tenant";
import {
  BOOKING_CAPABILITY_LABELS,
  normalizeSubscriptionPlan,
  PLAN_UNLOCK_HINT,
  type BookingCapability,
} from "@/lib/domain/booking-entitlements";
import {
  catalogEntryForSubscription,
  formatPlanPriceThb,
  PUBLIC_SAAS_PLANS,
  resolveKubHaiSaasPaymentConfig,
  SAAS_PLAN_CHANGE_NOTICE_TH,
  listSaasPlanAnnouncements,
} from "@/lib/domain/saas-plans";

export const dynamic = "force-dynamic";

/**
 * SaaS subscription billing — Partner pays KubHai.
 * Separate from customer booking payment accounts in Store Settings.
 */
export default async function StoreBillingPage() {
  const ctx = await requireStoreContext();
  if (!ctx.businessId || !ctx.business) return <p>บัญชีนี้ยังไม่มีร้าน</p>;

  const role = ctx.session.role;
  // Prefer OWNER / ADMIN / STORE_SETTINGS_MANAGE — not all staff
  if (role === "BUSINESS_STAFF") {
    const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
    const me = board.staff.find((item) => item.userId === ctx.session.userId);
    const allowed =
      me?.staffRole === "OWNER" ||
      me?.staffRole === "ADMIN" ||
      me?.permissions.includes("STORE_SETTINGS_MANAGE");
    if (!allowed) {
      return (
        <div className="rounded-2xl bg-white p-6 text-sm text-muted">
          หน้านี้สำหรับเจ้าของร้านหรือผู้มีสิทธิ์ตั้งค่าร้าน ·{" "}
          <Link href="/store" className="font-medium text-navy-800">
            กลับภาพรวม
          </Link>
        </div>
      );
    }
  } else if (role !== "BUSINESS_OWNER" && role !== "SUPER_ADMIN") {
    redirect("/store");
  }

  const planId = normalizeSubscriptionPlan(ctx.business.subscriptionPlan);
  const current = catalogEntryForSubscription(ctx.business.subscriptionPlan);
  const payment = resolveKubHaiSaasPaymentConfig();
  const announcements = listSaasPlanAnnouncements();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs text-muted">KubHai SaaS</p>
        <h1 className="text-2xl font-semibold text-navy-800">แพ็กเกจและการชำระเงิน</h1>
        <p className="mt-1 text-sm text-muted">
          ค่าบริการใช้ระบบ KubHai — แยกจากเงินที่ลูกค้าจ่ายค่ารถให้ร้าน
        </p>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs font-medium text-muted">แพ็กเกจปัจจุบัน</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold text-navy-800">{current.nameTh}</p>
            <p className="mt-1 text-lg font-semibold text-navy-800">
              {formatPlanPriceThb(current.priceMonthlyThb)}{" "}
              <span className="text-sm font-normal text-muted">/ เดือน</span>
            </p>
            <p className="mt-2 text-sm text-success">สถานะ: ใช้งานอยู่</p>
          </div>
          <span className="rounded-full bg-navy-800 px-3 py-1 text-xs font-semibold text-white">
            แพ็กเกจปัจจุบัน
          </span>
        </div>
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {current.highlights.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted">
          สิทธิ์ระบบ: {planId}
          {planId === "enterprise" ? " (แสดงในกลุ่ม Business สำหรับราคา 3 แพ็กเกจ)" : ""}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-navy-800">แพ็กเกจอื่น</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {PUBLIC_SAAS_PLANS.map((plan) => {
            const isCurrent = plan.id === current.id;
            return (
              <article
                key={plan.id}
                className={`rounded-2xl border p-4 ${
                  isCurrent ? "border-navy-800 bg-navy-800/5" : "border-line bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-navy-800">{plan.nameTh}</p>
                  {isCurrent ? (
                    <span className="rounded-full bg-navy-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                      แพ็กเกจปัจจุบัน
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-lg font-semibold text-navy-800">
                  {formatPlanPriceThb(plan.priceMonthlyThb)}
                  <span className="text-sm font-normal text-muted"> / เดือน</span>
                </p>
                <p className="mt-1 text-xs text-muted">{plan.tagline}</p>
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  {plan.highlights.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-navy-800">
                    ดูรายละเอียดทั้งหมด
                  </summary>
                  <ul className="mt-2 space-y-1 text-[11px] text-muted">
                    {plan.capabilityKeys.map((key) => (
                      <li key={key}>• {BOOKING_CAPABILITY_LABELS[key as BookingCapability]}</li>
                    ))}
                  </ul>
                </details>
                {!isCurrent ? (
                  <p className="mt-4 text-center text-xs text-muted">
                    {plan.priceMonthlyThb > current.priceMonthlyThb ? "อัปเกรด" : "เปลี่ยนแพ็กเกจ"}{" "}
                    — ติดต่อ KubHai / ชำระด้านล่างเมื่อพร้อม
                  </p>
                ) : (
                  <p className="mt-4 text-center text-xs font-medium text-success">ใช้งานอยู่</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-navy-800">การชำระค่าบริการระบบ</h2>
        <p className="mt-1 text-xs text-muted">
          ช่องทางรับเงินของ KubHai — ไม่ใช่บัญชีรับเงินจองของลูกค้าในตั้งค่าร้าน
        </p>
        {payment.configured ? (
          <div className="mt-4 space-y-2 text-sm">
            {payment.promptPayId ? <p>PromptPay: {payment.promptPayId}</p> : null}
            {payment.bankName ? (
              <p>
                {payment.bankName} · {payment.bankAccountName} · {payment.bankAccountNumber}
              </p>
            ) : null}
            {payment.promptPayQrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={payment.promptPayQrUrl} alt="QR ชำระค่าบริการระบบ" className="mt-2 h-40 w-40 object-contain" />
            ) : null}
            {payment.note ? <p className="text-xs text-muted">{payment.note}</p> : null}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-sm text-muted">
            ยังไม่ได้ตั้งค่าช่องทางรับเงินค่าบริการระบบของ KubHai · ติดต่อทีมแพลตฟอร์มเพื่อชำระ/ต่ออายุแพ็กเกจ
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-navy-800">ประวัติการชำระค่าระบบ</h2>
        <p className="mt-3 text-sm text-muted">ยังไม่มีรายการชำระในระบบ — จะแสดงเมื่อมีการบันทึกจริง</p>
      </section>

      {announcements.length ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-navy-800">ประกาศเกี่ยวกับแพ็กเกจ</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {announcements.map((item) => (
              <li key={item.id} className="rounded-xl bg-paper px-3 py-2">
                <p className="font-medium text-navy-800">{item.title}</p>
                <p className="text-muted">{item.shortMessage}</p>
                {item.effectiveDate ? (
                  <p className="mt-1 text-xs text-muted">มีผล {item.effectiveDate}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <aside className="rounded-2xl border border-danger/25 bg-danger/[0.04] px-4 py-3 text-sm leading-6 text-navy-800">
        {SAAS_PLAN_CHANGE_NOTICE_TH}
      </aside>

      <p className="text-[11px] text-muted">
        ตัวอย่างสิทธิ์ที่ล็อกตามแพ็กเกจ: {PLAN_UNLOCK_HINT["booking.customHero"]} ·{" "}
        <Link href="/store/settings?tab=appearance" className="underline">
          รูปลักษณ์หน้าจอง
        </Link>
      </p>
    </div>
  );
}
