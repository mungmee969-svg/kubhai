import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RememberStoreContext } from "@/components/brand/RememberStoreContext";
import {
  ContactStoreLinks,
  StoreBrandScope,
  StoreLogo,
} from "@/components/brand/StoreBrand";
import { brandingMetadata } from "@/components/brand/CustomerStoreChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  partnerBookingsClaimPath,
  partnerLoginHrefWithClaim,
} from "@/lib/auth/customer-auth-links";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import { revealsAssignment } from "@/lib/domain/booking-rules";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  if (!token || token.length < 20) return { title: "ส่งคำขอจอง" };
  const raw = await getStore().getBookingByToken(token);
  if (!raw) return { title: "ส่งคำขอจอง" };
  return brandingMetadata(raw.business, "ส่งคำขอจอง");
}

export default async function BookingSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const raw = await getStore().getBookingByToken(token);
  if (!raw) notFound();
  const brand = resolveCustomerStorefrontBranding(raw.business);
  const presentation = resolveBookingPresentation({ business: raw.business });
  const { booking, business } = raw;
  const confirmed = revealsAssignment(booking.status);
  const session = await getCustomerSession();
  // Guest bookings are only reachable by token — carry it so «my bookings» is never empty.
  const myBookingsHref = session
    ? partnerBookingsClaimPath(business.slug, token)
    : partnerLoginHrefWithClaim(business.slug, `/s/${business.slug}/bookings`, token);
  const headline = confirmed ? "ยืนยันการจองแล้ว" : "ส่งคำขอจองแล้ว";
  const hero = presentation.hero.desktopUrl;

  const timeline = confirmed
    ? [
        { done: true, label: "ส่งคำขอแล้ว" },
        { done: true, label: "ร้านตรวจสอบรถ" },
        { done: true, label: "รับใบเสนอราคา" },
        { done: true, label: "ยืนยันและชำระมัดจำ" },
        { done: true, label: "ยืนยันการจอง" },
      ]
    : [
        { done: true, label: "ส่งคำขอแล้ว" },
        { done: false, label: "ทางร้านตรวจสอบรายละเอียด" },
        { done: false, label: "รับใบเสนอราคา" },
        { done: false, label: "ยืนยันข้อเสนอ" },
        { done: false, label: "ชำระเงิน" },
        { done: false, label: "ยืนยันการจอง" },
      ];

  return (
    <StoreBrandScope brand={brand} className="booking-shell booking-atm-review min-h-dvh">
      <RememberStoreContext slug={business.slug} />
      <div className="booking-shell-bg" aria-hidden />

      <header className="relative overflow-hidden text-white booking-hero-short">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        ) : null}
        <div className="booking-hero-overlay absolute inset-0" />
        <div className="relative mx-auto max-w-lg px-5 pb-10 pt-6 text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <StoreLogo brand={brand} size={48} className="bg-white shadow-sm" />
          </div>
          <p className="text-3xl" aria-hidden>
            ✓
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{headline}</h1>
          {!confirmed ? (
            <p className="mt-2 text-sm text-white/80">ร้านกำลังตรวจสอบรถและราคา</p>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-6 max-w-lg space-y-4 px-4 pb-10">
        <section className="booking-review-card text-center">
          <p className="text-xs text-muted">รหัสคำขอ</p>
          <p className="mt-1 text-xl font-semibold tracking-wide text-[color:var(--store-primary,#0F3D3E)]">
            {booking.bookingCode}
          </p>
          <div className="mt-3 flex justify-center">
            <StatusBadge status={booking.status} audience="customer" />
          </div>
          <dl className="mt-4 space-y-2 text-left text-sm">
            <Row
              label="วันเวลา"
              value={`${booking.startDate}${booking.startTime ? ` ${booking.startTime}` : ""}`}
            />
            <Row label="รับที่" value={booking.pickupLocation} />
            <Row label="ส่งที่" value={booking.dropoffLocation ?? "-"} />
          </dl>
        </section>

        {!confirmed ? (
          <section className="booking-review-card">
            <p className="mb-3 text-sm font-semibold">ขั้นตอนถัดไป</p>
            <ol className="space-y-0">
              {timeline.map((item, index) => (
                <li key={item.label} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < timeline.length - 1 ? (
                    <span
                      className="absolute left-[11px] top-6 bottom-0 w-px bg-[color:var(--store-primary,#0F3D3E)]/20"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      item.done
                        ? "bg-[color:var(--store-accent,#C4A35A)] text-[#1a1510]"
                        : "bg-[color:var(--store-primary-soft,#E7EFEA)] text-[color:var(--store-primary,#0F3D3E)]"
                    }`}
                  >
                    {item.done ? "✓" : index + 1}
                  </span>
                  <span className={`pt-0.5 text-sm ${item.done ? "font-medium" : ""}`}>{item.label}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs leading-5 text-muted">
              การส่งคำขอยังไม่ใช่การยืนยันการจอง — รอใบเสนอราคาจากร้าน
            </p>
          </section>
        ) : (
          <p className="booking-review-card text-sm leading-6 text-muted">
            การจองได้รับการยืนยันแล้ว สามารถดูรายละเอียดและชำระเงินได้
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Link href={`/booking/${token}`} className="booking-cta-gold">
            ดูรายละเอียดการจอง
          </Link>
          <Link
            href={myBookingsHref}
            className="flex h-[3.15rem] items-center justify-center rounded-2xl bg-white text-sm font-semibold shadow-sm"
          >
            การจองของฉัน
          </Link>
          {business.phone ? (
            <a
              href={`tel:${business.phone}`}
              className="flex h-[3.15rem] items-center justify-center rounded-2xl bg-white text-sm font-semibold shadow-sm"
            >
              ติดต่อร้าน
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="flex h-[3.15rem] items-center justify-center rounded-2xl bg-line text-sm text-muted"
            >
              ติดต่อร้าน
            </button>
          )}
        </div>

        <ContactStoreLinks brand={brand} />
      </main>
    </StoreBrandScope>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
