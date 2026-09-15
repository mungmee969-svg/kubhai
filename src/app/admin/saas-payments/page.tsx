import { PlatformAdminShell } from "@/components/admin/PlatformAdminShell";
import { reviewSaasPaymentProofAction } from "@/lib/actions/saas-billing";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { formatPlanPriceThb } from "@/lib/domain/saas-plans";

export const dynamic = "force-dynamic";

export default async function SaasPaymentReviewPage() {
  const ctx = await requirePlatformAdmin();
  const [proofs, businesses] = await Promise.all([
    ctx.store.listPlatformSaasProofs(ctx.actor),
    ctx.store.listBusinesses(ctx.actor),
  ]);
  const accounts = await Promise.all(
    businesses.map(async (business) => ({
      business,
      billing: await ctx.store.getSaasBillingAccount(ctx.actor, business.id),
    })),
  );
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleString("th-TH") : "—";

  return (
    <PlatformAdminShell>
      <h1 className="text-2xl font-semibold">SaaS Payment Review</h1>
      <p className="mt-2 text-sm text-white/60">
        หลักฐาน Store → KubHai เท่านั้น ไม่รวมสลิปเงินจองลูกค้า
      </p>
      <div className="mt-6 space-y-4">
        {proofs.map((proof) => {
          const account = accounts.find(
            (item) => item.business.id === proof.businessId,
          );
          const period = account?.billing.billingPeriods.find(
            (item) => item.id === proof.billingPeriodId,
          );
          return (
            <article key={proof.id} className="grid gap-4 rounded-3xl bg-white/5 p-5 md:grid-cols-[240px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof.imageDataUrl} alt="หลักฐานชำระ SaaS" className="max-h-80 w-full rounded-2xl object-contain bg-black/20" />
              <div>
                <h2 className="text-lg font-semibold">
                  {account?.business.name ?? proof.businessId}
                </h2>
                <div className="mt-2 space-y-1 text-sm text-white/70">
                  <p>สถานะ: {proof.status}</p>
                  <p>รอบบิล: {period?.planNameSnapshot ?? "—"} · {date(period?.periodStart ?? null)} – {date(period?.periodEnd ?? null)}</p>
                  <p>ยอดคาดหวัง: {formatPlanPriceThb(proof.expectedAmountThb)}</p>
                  <p>ยอดที่แจ้ง: {formatPlanPriceThb(proof.submittedAmountThb)}</p>
                  <p>ส่งเมื่อ: {date(proof.submittedAt)}</p>
                  <p>ตรวจเมื่อ: {date(proof.reviewedAt)}</p>
                  <p>ผู้ตรวจ: {proof.reviewedByUserId ?? "—"}</p>
                  <p>Provider verification: {proof.providerVerificationResult ? "มีข้อมูลจริง" : "ไม่ได้ตั้งค่า"}</p>
                  {proof.duplicateOfProofId ? <p className="text-warning">อาจเป็นไฟล์ซ้ำกับ {proof.duplicateOfProofId}</p> : null}
                  {proof.rejectionReason ? <p className="text-danger">เหตุผล: {proof.rejectionReason}</p> : null}
                </div>
                {proof.status === "AWAITING_REVIEW" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <form action={reviewSaasPaymentProofAction}>
                      <input type="hidden" name="proofId" value={proof.id} />
                      <input type="hidden" name="decision" value="APPROVE" />
                      <button className="h-11 w-full rounded-xl bg-success px-4 text-sm font-semibold text-white">
                        อนุมัติ
                      </button>
                    </form>
                    <form action={reviewSaasPaymentProofAction} className="space-y-2">
                      <input type="hidden" name="proofId" value={proof.id} />
                      <input type="hidden" name="decision" value="REJECT" />
                      <input name="reason" required placeholder="เหตุผลที่ไม่ผ่าน" className="h-11 w-full rounded-xl bg-white px-3 text-sm text-navy-950" />
                      <button className="h-11 w-full rounded-xl bg-danger px-4 text-sm font-semibold text-white">
                        ไม่ผ่าน
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
        {!proofs.length ? (
          <p className="rounded-2xl bg-white/5 p-5 text-sm text-white/60">
            ยังไม่มีหลักฐานการชำระ SaaS
          </p>
        ) : null}
      </div>
    </PlatformAdminShell>
  );
}
