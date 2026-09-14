import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { requireStoreContext } from "@/lib/auth/tenant";
import { formatThaiDate, todayBangkok } from "@/lib/domain/ops";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const { id } = await params;
  const customer = await ctx.store.getCustomer(ctx.actor, id);
  if (!customer) notFound();
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const today = todayBangkok();
  const history = board.bookings
    .filter((item) => item.customerId === customer.id)
    .sort((a, b) => `${b.startDate}${b.startTime}`.localeCompare(`${a.startDate}${a.startTime}`));
  const upcoming = history.filter((item) => item.startDate >= today && item.status !== "CANCELLED" && item.status !== "REJECTED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-800">{customer.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {customer.phone ?? "ไม่มีเบอร์"}
          {customer.email ? ` · ${customer.email}` : ""}
        </p>
      </div>

      <section>
        <h2 className="font-semibold text-navy-800">งานถัดไป</h2>
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 ? <EmptyState title="ยังไม่มีงานถัดไป" /> : null}
          {upcoming.map((booking) => (
            <Link key={booking.id} href={`/store/bookings/${booking.id}`} className="block rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">
                    {formatThaiDate(booking.startDate)} {booking.startTime ?? ""}
                  </p>
                  <p className="font-medium">{booking.bookingCode}</p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-navy-800">ประวัติ Booking</h2>
        <div className="mt-3 space-y-2">
          {history.slice(0, 30).map((booking) => (
            <Link key={booking.id} href={`/store/bookings/${booking.id}`} className="flex items-center justify-between rounded-2xl bg-white p-4">
              <span className="text-sm">
                {formatThaiDate(booking.startDate)} · {booking.bookingCode}
              </span>
              <StatusBadge status={booking.status} />
            </Link>
          ))}
          {history.length === 0 ? <p className="text-sm text-muted">ยังไม่มีประวัติ</p> : null}
        </div>
      </section>
    </div>
  );
}
