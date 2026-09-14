"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentInstructions } from "@/components/payment/PaymentInstructions";
import { submitCustomerPaymentProofAction } from "@/lib/actions/payment-proof";
import { INTENT_LABEL, REVIEW_LABEL } from "@/lib/domain/payment-accounts";
import { buildPaymentInstruction, resolvePaymentPurpose } from "@/lib/domain/payment-instructions";
import { formatMoney } from "@/lib/domain/ops";
import { money } from "@/lib/domain/settlement";
import type { Settlement } from "@/lib/domain/settlement";
import type { PaymentAccount, PaymentProof, PaymentProofIntent } from "@/lib/domain/types";

function depositIsAuthoritativelyApproved(
  proofs: PaymentProof[],
  settlement: Settlement,
): { approved: boolean; amount: number } {
  const approvedProof = proofs.find(
    (item) => item.reviewStatus === "APPROVED" && item.paymentIntent === "DEPOSIT",
  );
  if (approvedProof) {
    return { approved: true, amount: money(approvedProof.claimedAmount) };
  }
  const expected = money(settlement.expectedDeposit);
  if (expected > 0 && settlement.depositReceived >= expected) {
    return { approved: true, amount: settlement.depositReceived };
  }
  return { approved: false, amount: 0 };
}

export function CustomerPaymentProof({
  token,
  bookingId,
  bookingCode,
  account,
  settlement,
  proofs,
  enabled = true,
  title = "การชำระเงิน",
  storeName = "ทางร้าน",
}: {
  token: string;
  bookingId: string;
  bookingCode: string;
  account: PaymentAccount | null;
  settlement: Settlement;
  proofs: PaymentProof[];
  enabled?: boolean;
  title?: string;
  storeName?: string;
}) {
  const router = useRouter();
  const pendingProof = proofs.find((item) => item.reviewStatus === "PENDING_REVIEW");
  const rejectedProof = [...proofs]
    .reverse()
    .find((item) => item.reviewStatus === "REJECTED");
  const deposit = depositIsAuthoritativelyApproved(proofs, settlement);
  const customerPaid =
    (settlement.remainingBalance ?? 1) === 0 && settlement.customerPaidService > 0;
  const needsBalance =
    deposit.approved && (settlement.remainingBalance ?? 0) > 0 && settlement.state === "WAITING_BALANCE";
  const defaultPurpose = resolvePaymentPurpose(settlement);
  const [addTip, setAddTip] = useState(false);
  const [tip, setTip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const purpose: PaymentProofIntent =
    addTip && defaultPurpose === "SERVICE_BALANCE"
      ? "COMBINED_BALANCE_AND_TIP"
      : addTip && customerPaid
        ? "TIP_RECEIVED"
        : defaultPurpose;

  const instruction = useMemo(
    () =>
      buildPaymentInstruction({
        bookingCode,
        account,
        settlement,
        purpose,
        tipAmount: money(Number(tip || 0)),
      }),
    [account, bookingCode, purpose, settlement, tip],
  );

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("token", token);
    formData.set("bookingId", bookingId);
    formData.set("paymentIntent", purpose);
    formData.set("claimedAmount", String(instruction.transferTotal));
    formData.set("serviceAmount", String(instruction.remainingBalance ?? 0));
    formData.set("tipAmount", String(instruction.tipAmount));
    const result = await submitCustomerPaymentProofAction(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!enabled) return null;

  // D — deposit approved: success card, no deposit upload
  if (deposit.approved && !pendingProof && !needsBalance && !addTip) {
    return (
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">{title}</h2>
        <div className="mt-4 rounded-2xl border border-success/30 bg-success/10 px-4 py-4">
          <p className="text-lg font-semibold text-navy-800">จองสำเร็จ</p>
          <p className="mt-2 text-sm leading-6 text-navy-800">
            {storeName}ได้รับและตรวจสอบเงินมัดจำ {formatMoney(deposit.amount)} แล้ว
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            โปรดรอรับการติดต่อจาก{storeName}เพื่อยืนยันรายละเอียดการเดินทาง
          </p>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {proofs.map((proof) => (
            <li key={proof.id} className="rounded-2xl bg-paper px-3 py-2">
              <p>
                {INTENT_LABEL[proof.paymentIntent]} {formatMoney(proof.claimedAmount)}
              </p>
              <p className="text-xs text-muted">
                {REVIEW_LABEL[proof.reviewStatus]}
                {proof.rejectReason ? ` — ${proof.rejectReason}` : ""}
              </p>
            </li>
          ))}
        </ul>
        {customerPaid ? null : (
          <label className="mt-4 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={addTip} onChange={(e) => setAddTip(e.target.checked)} />
            ส่งสลิปทิปเพิ่ม (ไม่บังคับ)
          </label>
        )}
      </section>
    );
  }

  // B — pending review
  if (pendingProof) {
    return (
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-semibold">{title}</h2>
        <PaymentInstructions instruction={instruction} />
        <div className="mt-4 rounded-2xl bg-accent/15 px-4 py-4">
          <p className="font-semibold text-navy-800">ส่งหลักฐานการชำระเงินแล้ว</p>
          <p className="mt-1 text-sm text-muted">กำลังรอทางร้านตรวจสอบ</p>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {proofs.map((proof) => (
            <li key={proof.id} className="rounded-2xl bg-paper px-3 py-2">
              <p>
                {INTENT_LABEL[proof.paymentIntent]} {formatMoney(proof.claimedAmount)}
              </p>
              <p className="text-xs text-muted">{REVIEW_LABEL[proof.reviewStatus]}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // A / C — no proof or rejected → allow upload
  return (
    <section className="rounded-3xl bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      <PaymentInstructions instruction={instruction} />

      {rejectedProof ? (
        <div className="mt-3 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm">
          <p className="font-medium text-danger">สลิปถูกปฏิเสธ — ส่งใหม่ได้</p>
          {rejectedProof.rejectReason ? (
            <p className="mt-1 text-muted">{rejectedProof.rejectReason}</p>
          ) : null}
        </div>
      ) : null}

      {customerPaid && !addTip ? (
        <p className="mt-3 text-sm font-medium text-success">ชำระค่าบริการครบแล้ว</p>
      ) : null}

      <ul className="mt-3 space-y-2 text-sm">
        {proofs.map((proof) => (
          <li key={proof.id} className="rounded-2xl bg-paper px-3 py-2">
            <p>
              {INTENT_LABEL[proof.paymentIntent]} {formatMoney(proof.claimedAmount)}
            </p>
            <p className="text-xs text-muted">
              {REVIEW_LABEL[proof.reviewStatus]}
              {proof.rejectReason ? ` — ${proof.rejectReason}` : ""}
            </p>
          </li>
        ))}
      </ul>

      {!customerPaid || addTip || purpose === "TIP_RECEIVED" ? (
        <form className="mt-4 space-y-3" action={(formData) => void submit(formData)}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={addTip} onChange={(e) => setAddTip(e.target.checked)} />
            เพิ่มทิป (ไม่บังคับ)
          </label>
          {addTip ? (
            <label className="block text-sm">
              ทิป
              <input
                className="admin-input mt-1"
                inputMode="numeric"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm">
            แนบสลิป
            <input
              className="mt-2 block"
              type="file"
              name="slip"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || instruction.transferTotal <= 0}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-store text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "กำลังส่ง..." : "ส่งสลิป"}
          </button>
        </form>
      ) : (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={addTip} onChange={(e) => setAddTip(e.target.checked)} />
          ส่งสลิปทิปแยก
        </label>
      )}
    </section>
  );
}
