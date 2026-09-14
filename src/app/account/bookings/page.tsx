import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStoreContextSlug } from "@/lib/auth/store-context";
import { platformLoginHref } from "@/lib/auth/customer-auth-links";
import { getStore } from "@/lib/data";
import { formatThaiDate } from "@/lib/domain/ops";
import { customerStatusLabel } from "@/lib/domain/status-ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Platform account bookings list.
 * If the customer arrived from a Partner storefront (store context cookie),
 * send them to the Partner-branded My Bookings surface instead of KubHai chrome.
 */
export default async function AccountBookingsPage() {
  const session = await getCustomerSession();
  if (!session) redirect(platformLoginHref("/account/bookings"));

  const storeSlug = await getStoreContextSlug();
  if (storeSlug) {
    const store = await getStore().getPublicStore(storeSlug);
    if (store) redirect(`/s/${storeSlug}/bookings`);
  }

  const bookings = await getStore().listCustomerBookings(session.customerAccountId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-800">การจองของฉัน</h1>
      <p className="text-sm text-muted">
        สำหรับการจองจากหน้าร้านพาร์ทเนอร์ ให้เปิดจากหน้าร้านนั้นเพื่อเห็นแบรนด์ของร้าน
      </p>
      {bookings.length === 0 ? (
        <p className="rounded-3xl bg-white p-5 text-sm text-muted">ยังไม่มีการจอง</p>
      ) : (
        bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/account/bookings/${booking.id}`}
            className="block rounded-3xl bg-white p-4"
          >
            <p className="font-semibold text-navy-800">{booking.bookingCode}</p>
            <p className="mt-1 text-sm text-muted">
              {formatThaiDate(booking.startDate)} · {customerStatusLabel(booking.status)}
            </p>
            <p className="mt-1 text-sm text-navy-800">
              {booking.pickupLocation}
              {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
            </p>
          </Link>
        ))
      )}
    </div>
  );
}
