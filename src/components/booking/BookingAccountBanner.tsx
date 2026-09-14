"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { claimBookingTokenAction } from "@/lib/actions/customer-auth";
import {
  bookingDetailClaimPath,
  partnerLoginHrefWithClaim,
  platformLoginHref,
} from "@/lib/auth/customer-auth-links";

export function BookingAccountBanner({
  token,
  linked,
  phoneVerified,
  loggedIn,
  storeSlug,
  storeName,
}: {
  token: string;
  linked: boolean;
  phoneVerified: boolean;
  loggedIn: boolean;
  storeSlug?: string | null;
  /** Partner short name — customer journey speaks the store's brand, not KubHai's. */
  storeName?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (linked) return null;

  async function claim() {
    setPending(true);
    setError(null);
    const result = await claimBookingTokenAction(token);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  // Phone verification and login both return through ?claim so the booking links itself.
  const claimReturnTo = bookingDetailClaimPath(token);
  const loginHref = storeSlug
    ? partnerLoginHrefWithClaim(storeSlug, `/s/${storeSlug}/bookings`, token)
    : platformLoginHref(claimReturnTo);
  const withStore = storeName ? `กับ ${storeName}` : "ของคุณ";

  return (
    <section className="rounded-3xl border border-navy-800/10 bg-white p-4">
      {!loggedIn ? (
        <>
          <p className="text-sm font-semibold text-navy-800">เก็บการจองนี้ไว้ในบัญชีของคุณ</p>
          <p className="mt-1 text-sm text-muted">
            เข้าสู่ระบบครั้งเดียว แล้วดูการจอง{withStore} ได้ทุกครั้งโดยไม่ต้องเก็บลิงก์
          </p>
          <Link
            href={loginHref}
            className="mt-3 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950"
          >
            เข้าสู่ระบบ / สมัคร
          </Link>
        </>
      ) : !phoneVerified ? (
        <>
          <p className="text-sm font-semibold text-navy-800">ยืนยันเบอร์โทรเพื่อเชื่อมการจอง</p>
          <p className="mt-1 text-sm text-muted">
            ใช้เบอร์เดียวกับที่แจ้งไว้ในการจองนี้
          </p>
          <Link
            href={`/account/security?next=${encodeURIComponent(claimReturnTo)}`}
            className="mt-3 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950"
          >
            ยืนยันเบอร์
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-navy-800">เชื่อมการจองนี้เข้าบัญชีของคุณ</p>
          <button
            type="button"
            disabled={pending}
            onClick={claim}
            className="mt-3 h-10 rounded-xl bg-navy-800 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "กำลังเชื่อม..." : "เชื่อมกับบัญชี"}
          </button>
        </>
      )}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
