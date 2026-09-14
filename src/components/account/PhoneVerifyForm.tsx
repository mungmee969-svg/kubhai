"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { OtpInput } from "@/components/account/OtpInput";
import {
  customerRequestPhoneOtpAction,
  customerVerifyPhoneAction,
} from "@/lib/actions/customer-auth";
import {
  BOOKING_CLAIM_PARAM,
  sanitizeCustomerReturnTo,
} from "@/lib/auth/customer-auth-links";

export function PhoneVerifyForm({ showDevHint = false }: { showDevHint?: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = sanitizeCustomerReturnTo(search.get("next"), "/account");
  // Arriving from a booking: the phone links an existing booking, it does not place one.
  const forClaim = new URLSearchParams(next.split("?")[1] ?? "").has(BOOKING_CLAIM_PARAM);
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await customerRequestPhoneOtpAction(phone);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setChallengeId(String(result.data?.challengeId));
    setDevHint(result.data?.devCode ? String(result.data.devCode) : null);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setPending(true);
    setError(null);
    const result = await customerVerifyPhoneAction({ challengeId, code });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-[color:var(--store-ink,#0F1724)]">ความปลอดภัย</h1>
      <p className="text-sm text-muted">
        {forClaim
          ? "ยืนยันเบอร์โทรเพื่อเชื่อมการจอง — ใช้เบอร์เดียวกับที่แจ้งไว้ในการจอง"
          : "ยืนยันเบอร์โทรเพื่อทำการจอง"}
      </p>
      {!challengeId ? (
        <form onSubmit={requestOtp} className="space-y-3">
          <input
            className="h-11 w-full rounded-xl border border-line px-3"
            placeholder="เบอร์โทร"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-xl bg-[color:var(--store-accent,#C4A35A)] font-semibold text-[#1a1510] disabled:opacity-60"
          >
            ส่งรหัส OTP
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          {showDevHint && devHint ? (
            <p className="rounded-lg border border-dashed border-black/15 bg-black/[0.03] px-3 py-2 text-[11px] text-muted">
              DEV TEST · OTP: <span className="font-mono font-semibold">{devHint}</span>
            </p>
          ) : null}
          <OtpInput value={code} onChange={setCode} autoFocus />
          <button
            type="submit"
            disabled={pending || code.length < 6}
            className="h-11 w-full rounded-xl bg-[color:var(--store-accent,#C4A35A)] font-semibold text-[#1a1510] disabled:opacity-60"
          >
            ยืนยันเบอร์
          </button>
        </form>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
