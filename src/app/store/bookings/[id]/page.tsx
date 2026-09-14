import { notFound } from "next/navigation";
import { BookingWorkspace } from "@/components/store-admin/booking/BookingWorkspace";
import { requireStoreContext } from "@/lib/auth/tenant";

export const dynamic = "force-dynamic";

export default async function StoreBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ proof?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const { id } = await params;
  const { proof } = await searchParams;
  const record = await ctx.store.getBookingById(ctx.actor, id);
  if (!record) notFound();
  const board = await ctx.store.loadTenantBoard(ctx.actor, record.booking.businessId);
  const accounts = await ctx.store.listPaymentAccounts(ctx.actor, record.booking.businessId, {
    includeInactive: true,
  });
  const driverJob = await ctx.store.listDriverJobForBooking(ctx.actor, id);

  return (
    <BookingWorkspace
      record={record}
      vehicles={board.vehicles}
      drivers={board.drivers}
      places={board.places}
      bookings={board.bookings}
      accounts={accounts}
      initialProofId={proof}
      driverJob={driverJob}
    />
  );
}
