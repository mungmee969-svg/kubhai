import { notFound } from "next/navigation";
import { BookingWorkspace } from "@/components/store-admin/booking/BookingWorkspace";
import { requireStoreContext } from "@/lib/auth/tenant";
import { getDurableStoreBookingById } from "@/lib/data/supabase-store-booking";
import type { BookingRecord } from "@/lib/data/repository";
import { localizedPackageText } from "@/lib/domain/trip-package";

export const dynamic = "force-dynamic";

export default async function StoreBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ proof?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId || !ctx.business) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const { id } = await params;
  const { proof } = await searchParams;

  let record = await ctx.store.getBookingById(ctx.actor, id);
  if (!record) {
    const durable = await getDurableStoreBookingById(ctx.businessId, id);
    if (durable) {
      const boardForVehicle = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
      const preferredVehicle = durable.booking.preferredVehicleId
        ? boardForVehicle.vehicles.find((item) => item.id === durable.booking.preferredVehicleId) ?? null
        : null;
      record = {
        booking: durable.booking,
        itinerary: durable.itinerary,
        vehicle: null,
        preferredVehicle,
        driver: null,
        business: ctx.business,
        customer: null,
        notes: [],
        movements: [],
        proofs: [],
        receivingAccount: null,
        quotations: [],
        auditLogs: [],
        tripCheckIns: [],
      } satisfies BookingRecord;
    }
  }
  if (!record || record.booking.businessId !== ctx.businessId) notFound();

  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const accounts = await ctx.store.listPaymentAccounts(ctx.actor, ctx.businessId, {
    includeInactive: true,
  });
  const driverJob = await ctx.store.listDriverJobForBooking(ctx.actor, id);
  const tripPackage = record.booking.tripPackageId
    ? await ctx.store.getTripPackage(ctx.actor, record.booking.tripPackageId)
    : null;

  return (
    <BookingWorkspace
      record={record}
      tripPackageTitle={
        tripPackage ? localizedPackageText("th", tripPackage.title, "แพ็กเกจทริป") : null
      }
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
