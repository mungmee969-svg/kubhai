import Link from "next/link";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { FinanceBadge } from "@/components/store-admin/booking/FinanceBadge";
import { ProofReviewLink } from "@/components/store-admin/booking/ProofReviewLink";
import { requireStoreContext } from "@/lib/auth/tenant";
import { formatAccountLine, INTENT_LABEL, REVIEW_LABEL } from "@/lib/domain/payment-accounts";
import { formatMoney, formatThaiDate, formatThaiDateTime, todayBangkok } from "@/lib/domain/ops";
import { isFixtureBooking, operationalBookings } from "@/lib/domain/fixtures";
import { financePageMatch, settleBooking } from "@/lib/domain/settlement";

export const dynamic = "force-dynamic";

const TABS = [
  ["SLIP_REVIEW", "สลิปรอตรวจ"],
  ["RECEIVABLE", "ลูกค้าค้างชำระ"],
  ["WAITING_DRIVER", "ค่าตัวค้างจ่าย"],
  ["WAITING_TIP", "ทิปรอโอน"],
  ["CLOSED", "เพิ่งปิดยอด"],
  ["CUSTOMER_PAID", "ลูกค้าชำระครบ"],
  ["ALL", "ทั้งหมด"],
] as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; date?: string; q?: string; proof?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const query = await searchParams;
  const filter = query.filter ?? "SLIP_REVIEW";
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const movements = await ctx.store.listMoneyMovements(ctx.actor, ctx.businessId);
  const proofs = await ctx.store.listPaymentProofs(ctx.actor, ctx.businessId);
  const today = todayBangkok();
  const rows = operationalBookings(board.bookings).map((booking) => ({
    booking,
    settlement: settleBooking(
      booking,
      movements.filter((item) => item.bookingId === booking.id),
    ),
  }));
  const visible = rows.filter(({ booking, settlement }) => {
    if (!financePageMatch(settlement.state, filter)) return false;
    if (query.date && booking.startDate !== query.date) return false;
    if (query.q) {
      const hay = `${booking.bookingCode} ${booking.customerNameSnapshot}`.toLowerCase();
      if (!hay.includes(query.q.toLowerCase())) return false;
    }
    return true;
  });

  const customerDue = rows.reduce((sum, item) => sum + (item.settlement.remainingBalance ?? 0), 0);
  const driverDue = rows.reduce((sum, item) => sum + item.settlement.driverDue, 0);
  const tipDue = rows.reduce((sum, item) => sum + item.settlement.tipDue, 0);
  const operationalIds = new Set(rows.map((item) => item.booking.id));
  const receivedToday = movements
    .filter((item) => item.direction === "IN" && operationalIds.has(item.bookingId) && item.occurredAt.slice(0, 10) === today)
    .reduce((sum, item) => sum + item.transferAmount, 0);
  const paidToday = movements
    .filter((item) => item.direction === "OUT" && operationalIds.has(item.bookingId) && item.occurredAt.slice(0, 10) === today)
    .reduce((sum, item) => sum + item.transferAmount, 0);

  const pendingProofs = proofs.filter((item) => {
    const booking = board.bookings.find((row) => row.id === item.bookingId);
    return item.reviewStatus === "PENDING_REVIEW" && booking && !isFixtureBooking(booking);
  });
  const proofRows = (filter === "SLIP_REVIEW" ? pendingProofs : proofs).filter((proof) => {
    const booking = board.bookings.find((item) => item.id === proof.bookingId);
    if (!booking || isFixtureBooking(booking)) return false;
    if (query.q) {
      const hay = `${booking.bookingCode} ${booking.customerNameSnapshot}`.toLowerCase();
      if (!hay.includes(query.q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy-800">การเงินงาน</h1>
      <p className="mt-1 text-sm text-muted">ติดตามเงินระดับงาน ไม่ใช่บัญชีภาษี · สลิปที่ยังไม่ตรวจไม่นับเป็นเงินรับ</p>
      <dl className="mt-4 grid gap-2 text-sm md:grid-cols-3 xl:grid-cols-6">
        <Mini label="สลิปรอตรวจ" value={pendingProofs.length} />
        <Mini label="ยอดลูกค้าค้าง" value={formatMoney(customerDue)} />
        <Mini label="ค่าตัวค้างจ่าย" value={formatMoney(driverDue)} />
        <Mini label="ทิปรอโอน" value={formatMoney(tipDue)} />
        <Mini label="ยอดรับวันนี้" value={formatMoney(receivedToday)} />
        <Mini label="ยอดจ่ายวันนี้" value={formatMoney(paidToday)} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/store/finance?filter=${key}`}
            className={`rounded-full px-3 py-2 text-sm ${filter === key ? "bg-navy-800 text-white" : "bg-white"}`}
          >
            {key === "SLIP_REVIEW" && pendingProofs.length ? `${label} ${pendingProofs.length}` : label}
          </Link>
        ))}
      </div>
      <form className="mt-4 grid gap-2 rounded-2xl bg-white p-3 md:grid-cols-3">
        <input name="q" defaultValue={query.q} placeholder="Booking / ลูกค้า" className="admin-input" />
        <input name="date" type="date" defaultValue={query.date} className="admin-input" />
        <input type="hidden" name="filter" value={filter} />
        <button className="h-11 rounded-xl bg-navy-800 text-sm text-white">กรอง</button>
      </form>

      {filter === "SLIP_REVIEW" ? (
        <ProofList
          proofs={proofRows}
          bookings={board.bookings}
          selectedId={query.proof}
        />
      ) : (
        <>
          <div className="mt-4 hidden overflow-hidden rounded-2xl bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Booking</th>
                  <th className="px-4 py-3 font-medium">ลูกค้า</th>
                  <th className="px-4 py-3 font-medium">ราคางาน</th>
                  <th className="px-4 py-3 font-medium">รับแล้ว</th>
                  <th className="px-4 py-3 font-medium">คงเหลือ</th>
                  <th className="px-4 py-3 font-medium">ค่าตัว</th>
                  <th className="px-4 py-3 font-medium">ทิป</th>
                  <th className="px-4 py-3 font-medium">จ่ายแล้ว</th>
                  <th className="px-4 py-3 font-medium">สถานะการเงิน</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ booking, settlement }) => (
                  <tr key={booking.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link href={`/store/bookings/${booking.id}`} className="font-medium text-navy-800">
                        {booking.bookingCode}
                      </Link>
                      <p className="text-xs text-muted">{formatThaiDate(booking.startDate)}</p>
                    </td>
                    <td className="px-4 py-3">{booking.customerNameSnapshot}</td>
                    <td className="px-4 py-3">{formatMoney(settlement.serviceTotal)}</td>
                    <td className="px-4 py-3">{formatMoney(settlement.customerPaidTotal)}</td>
                    <td className="px-4 py-3">{formatMoney(settlement.remainingBalance)}</td>
                    <td className="px-4 py-3">{formatMoney(settlement.driverFee)}</td>
                    <td className="px-4 py-3">{formatMoney(settlement.tipReceived)}</td>
                    <td className="px-4 py-3">{formatMoney(settlement.payoutPaid + settlement.tipPaidOut)}</td>
                    <td className="px-4 py-3">
                      <FinanceBadge state={settlement.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <div className="p-4">
                <EmptyState title="ยังไม่มีรายการเงินในช่วงนี้" />
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-3 lg:hidden">
            {visible.length === 0 ? <EmptyState title="ยังไม่มีรายการเงินในช่วงนี้" /> : null}
            {visible.map(({ booking, settlement }) => (
              <Link key={booking.id} href={`/store/bookings/${booking.id}`} className="block rounded-2xl bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">
                      {formatThaiDate(booking.startDate)} · {booking.bookingCode}
                    </p>
                    <p className="font-medium">{booking.customerNameSnapshot}</p>
                  </div>
                  <FinanceBadge state={settlement.state} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  ราคา {formatMoney(settlement.serviceTotal)} · ค้าง {formatMoney(settlement.remainingBalance)} · ค่าตัวค้าง{" "}
                  {formatMoney(settlement.driverDue)}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProofList({
  proofs,
  bookings,
  selectedId,
}: {
  proofs: {
    id: string;
    bookingId: string;
    paymentIntent: "DEPOSIT" | "SERVICE_BALANCE" | "TIP_RECEIVED" | "COMBINED_BALANCE_AND_TIP";
    claimedAmount: number;
    receivingAccountSnapshot: Parameters<typeof formatAccountLine>[0];
    submittedAt: string;
    slipFileId: string;
    reviewStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";
  }[];
  bookings: { id: string; bookingCode: string; customerNameSnapshot: string }[];
  selectedId?: string;
}) {
  if (!proofs.length) {
    return (
      <div className="mt-4">
        <EmptyState title="ไม่มีสลิปรอตรวจสอบ" />
      </div>
    );
  }
  return (
    <>
      <div className="mt-4 hidden overflow-hidden rounded-2xl bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Booking</th>
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 font-medium">ประเภท</th>
              <th className="px-4 py-3 font-medium">ยอดที่แจ้ง</th>
              <th className="px-4 py-3 font-medium">บัญชีรับ</th>
              <th className="px-4 py-3 font-medium">ส่งเมื่อ</th>
              <th className="px-4 py-3 font-medium">สลิป</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {proofs.map((proof) => {
              const booking = bookings.find((item) => item.id === proof.bookingId);
              return (
                <tr key={proof.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{booking?.bookingCode}</td>
                  <td className="px-4 py-3">{booking?.customerNameSnapshot}</td>
                  <td className="px-4 py-3">{INTENT_LABEL[proof.paymentIntent]}</td>
                  <td className="px-4 py-3">{formatMoney(proof.claimedAmount)}</td>
                  <td className="px-4 py-3">{formatAccountLine(proof.receivingAccountSnapshot)}</td>
                  <td className="px-4 py-3">{formatThaiDateTime(proof.submittedAt)}</td>
                  <td className="px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/store/slips/${proof.slipFileId}`} alt="" className="h-12 w-10 rounded-lg object-cover" />
                  </td>
                  <td className="px-4 py-3">{REVIEW_LABEL[proof.reviewStatus]}</td>
                  <td className="px-4 py-3">
                    <ProofReviewLink bookingId={proof.bookingId} proofId={proof.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-3 lg:hidden">
        {proofs.map((proof) => {
          const booking = bookings.find((item) => item.id === proof.bookingId);
          return (
            <article key={proof.id} className="rounded-2xl bg-white p-4">
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/store/slips/${proof.slipFileId}`} alt="" className="h-20 w-16 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="text-xs text-muted">{booking?.bookingCode}</p>
                  <p className="font-medium">{booking?.customerNameSnapshot}</p>
                  <p className="text-sm">
                    {INTENT_LABEL[proof.paymentIntent]} {formatMoney(proof.claimedAmount)}
                  </p>
                  <p className="text-xs text-muted">{formatAccountLine(proof.receivingAccountSnapshot)}</p>
                  <p className="text-xs text-muted">{formatThaiDateTime(proof.submittedAt)}</p>
                </div>
              </div>
              <div className="mt-3">
                <ProofReviewLink bookingId={proof.bookingId} proofId={proof.id} />
              </div>
            </article>
          );
        })}
      </div>
      {selectedId ? <p className="sr-only">{selectedId}</p> : null}
    </>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-navy-800">{value}</dd>
    </div>
  );
}
