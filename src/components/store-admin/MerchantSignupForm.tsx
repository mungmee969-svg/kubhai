"use client";

import { useActionState } from "react";
import {
  provisionMerchantAction,
  type SaasActionResult,
} from "@/lib/actions/saas-billing";

export function MerchantSignupForm({
  planId,
  idempotencyKey,
}: {
  planId: "starter" | "pro" | "business";
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState<
    SaasActionResult | null,
    FormData
  >(provisionMerchantAction, null);

  return (
    <form action={action} className="mx-auto mt-8 max-w-xl space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-navy-950/8">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <h2 className="text-lg font-semibold">สร้างบัญชีและพื้นที่ร้าน</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          ชื่อเจ้าของร้าน
          <input className="admin-input mt-1" name="ownerName" required />
        </label>
        <label className="block text-sm text-muted">
          อีเมล
          <input className="admin-input mt-1" name="email" type="email" required />
        </label>
        <label className="block text-sm text-muted">
          ชื่อร้าน
          <input className="admin-input mt-1" name="storeName" required />
        </label>
        <label className="block text-sm text-muted">
          URL ร้าน
          <input
            className="admin-input mt-1"
            name="storeSlug"
            pattern="[a-z0-9][a-z0-9-]{2,39}"
            placeholder="my-travel-store"
            required
          />
        </label>
      </div>
      <label className="block text-sm text-muted">
        รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
        <input
          className="admin-input mt-1"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-accent text-sm font-semibold text-navy-950 disabled:opacity-60"
      >
        {pending ? "กำลังสร้างร้าน…" : `สร้างร้านด้วยแพ็กเกจ ${planId.toUpperCase()}`}
      </button>
      <p className="text-[11px] leading-5 text-muted">
        ระบบจะสร้าง Subscription สถานะรอชำระและรอบบิลจริง
        โดยยังไม่ถือว่าชำระแล้วจนกว่าหลักฐานจะได้รับอนุมัติ
      </p>
    </form>
  );
}
