"use client";

import { useActionState } from "react";
import {
  submitSaasPaymentProofAction,
  type SaasActionResult,
} from "@/lib/actions/saas-billing";

export function SaasPaymentForm({
  billingPeriodId,
  amountThb,
}: {
  billingPeriodId: string;
  amountThb: number;
}) {
  const [state, action, pending] = useActionState<
    SaasActionResult | null,
    FormData
  >(submitSaasPaymentProofAction, null);

  return (
    <form action={action} className="mt-4 space-y-3 rounded-2xl bg-paper p-4">
      <input type="hidden" name="billingPeriodId" value={billingPeriodId} />
      <label className="block text-sm text-muted">
        ยอดที่ชำระ (บาท)
        <input
          className="admin-input mt-1"
          name="submittedAmountThb"
          inputMode="numeric"
          pattern="[0-9]+"
          defaultValue={amountThb}
          required
        />
      </label>
      <label className="block text-sm text-muted">
        รูปสลิป (JPG, PNG, WebP ไม่เกิน 2 MB)
        <input
          className="admin-input mt-1 py-2"
          name="slip"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center rounded-xl bg-navy-800 px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "กำลังส่ง…" : "ส่งหลักฐานการชำระ"}
      </button>
      <p className="text-[11px] text-muted">
        ระบบบันทึกเป็นหลักฐานค่าบริการ SaaS เท่านั้น ไม่เข้าส่วนชำระเงินของลูกค้า
      </p>
    </form>
  );
}
