import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { buildBookingCloseout } from "@/lib/domain/closeout";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";
import { settleBooking } from "@/lib/domain/settlement";
import { customerStatusLabel } from "@/lib/domain/status-ui";

export const dynamic = "force-dynamic";

const SECTIONS: { key: string; title: string; match: (status: string) => boolean }[] = [
  { key: "upcoming", title: "งานที่กำลังจะถึง", match: (s) => ["CONFIRMED", "IN_PROGRESS"].includes(s) },
  { key: "pending", title: "รอดำเนินการ", match: (s) => ["REQUESTED", "CHECKING_AVAILABILITY", "AVAILABLE"].includes(s) },
  { key: "quote", title: "รอใบเสนอราคา", match: (s) => s === "AVAILABLE" },
  { key: "confirm", title: "รอยืนยัน", match: (s) => s === "QUOTATION_SENT" },
  { key: "pay", title: "รอชำระเงิน", match: (s) => s === "WAITING_DEPOSIT" || s === "CUSTOMER_CONFIRMED" },
  { key: "confirmed", title: "ยืนยันแล้ว", match: (s) => s === "CONFIRMED" },
  { key: "done", title: "เสร็จสิ้น", match: (s) => s === "COMPLETED" },
  { key: "cancel", title: "ยกเลิก", match: (s) => s === "CANCELLED" || s === "REJECTED" },
];

export default async function AccountHomePage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  const store = getStore();
  const account = await store.getCustomerAccount(session.customerAccountId);
  const bookings = await store.listCustomerBookings(session.customerAccountId);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-white p-5">
        <p className="text-sm text-muted">สวัสดี</p>
        <h1 className="text-2xl font-semibold text-navy-800">
          {account?.displayName || account?.phone || "ลูกค้า KubHai"}
        </h1>
        {!session.phoneVerified ? (
          <div className="mt-3 rounded-2xl bg-accent/20 p-3 text-sm text-navy-800">
            <p className="font-semibold">ยืนยันเบอร์โทรเพื่อทำการจอง</p>
            <Link href="/account/security" className="mt-2 inline-block font-semibold text-navy-800 underline">
              ยืนยันเบอร์ตอนนี้
            </Link>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-800">การจองของฉัน</h2>
          <Link href="/account/bookings" className="text-sm text-navy-800">
            ทั้งหมด
          </Link>
        </div>
        {bookings.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-sm text-muted">ยังไม่มีการจอง</p>
        ) : (
          SECTIONS.map((section) => {
            const rows = bookings.filter((item) => section.match(item.status));
            if (!rows.length) return null;
            return (
              <div key={section.key} className="space-y-2">
                <h3 className="text-sm font-semibold text-navy-800">{section.title}</h3>
                {rows.slice(0, 4).map((booking) => (
                  <BookingCard key={booking.id} bookingId={booking.id} customerAccountId={session.customerAccountId} />
                ))}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

async function BookingCard({
  bookingId,
  customerAccountId,
}: {
  bookingId: string;
  customerAccountId: string;
}) {
  const record = await getStore().getCustomerBookingRecord(customerAccountId, bookingId);
  if (!record) return null;
  const settlement = settleBooking(record.booking, record.movements);
  const closeout = buildBookingCloseout(record.booking, record.movements, { vehicle: record.vehicle });
  const outstanding = closeout.customerOutstanding ?? 0;
  return (
    <Link href={`/account/bookings/${record.booking.id}`} className="block rounded-3xl bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy-800">{record.booking.bookingCode}</p>
          <p className="mt-1 text-sm text-muted">
            {formatThaiDate(record.booking.startDate)} · {record.business.name}
          </p>
          <p className="mt-1 text-xs text-muted">{customerStatusLabel(record.booking.status)}</p>
        </div>
        {outstanding > 0 ? (
          <span className="rounded-full bg-accent/25 px-2 py-1 text-xs font-semibold text-navy-800">
            ค้าง {formatMoney(outstanding)}
          </span>
        ) : settlement.customerPaidService > 0 ? (
          <span className="text-xs text-success">ชำระแล้ว</span>
        ) : null}
      </div>
    </Link>
  );
}
