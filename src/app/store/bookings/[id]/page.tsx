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

  // Production durable bookings must be resolved from Supabase first. The local
  // repository is a development fallback and may throw on Vercel's read-only FS.
  let record: BookingRecord | null = null;
  try {
    const durable = await getDurableStoreBookingById(ctx.businessId, id);
    if (durable) {
      let preferredVehicle = null;
      try {
        const boardForVehicle = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
        preferredVehicle = durable.booking.preferredVehicleId
          ? boardForVehicle.vehicles.find((item) => item.id === durable.booking.preferredVehicleId) ?? null
          : null;
      } catch {
        preferredVehicle = null;
      }
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
  } catch (error) {
    console.error("[store-booking] durable detail read failed", { bookingId: id });
  }
  if (!record) {
    try {
      record = await ctx.store.getBookingById(ctx.actor, id);
    } catch {
      record = null;
    }
  }
  if (!record || record.booking.businessId !== ctx.businessId) notFound();

  // These operational datasets are still local-backed. Treat them as optional
  // while production booking persistence is being migrated, without using
  // method ReturnType expressions that fail TypeScript on the repository object.
  let vehicles: BookingRecord["vehicle"][] = [];
  let drivers: unknown[] = [];
  let places: unknown[] = [];
  let bookings: unknown[] = [];
  try {
    const tenantBoard = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
    vehicles = tenantBoard.vehicles as typeof vehicles;
    drivers = tenantBoard.drivers;
    places = tenantBoard.places;
    bookings = tenantBoard.bookings;
  } catch {}
  let accounts: unknown[] = [];
  try {
    accounts = await ctx.store.listPaymentAccounts(ctx.actor, ctx.businessId, { includeInactive: true });
  } catch {}
  let driverJob = null;
  try {
    driverJob = await ctx.store.listDriverJobForBooking(ctx.actor, id);
  } catch {}
  const tripPackage = record.booking.tripPackageId
    ? await ctx.store.getTripPackage(ctx.actor, record.booking.tripPackageId)
    : null;

  return (
    <BookingWorkspace
      record={record}
      tripPackageTitle={
        tripPackage ? localizedPackageText("th", tripPackage.title, "แพ็กเกจทริป") : null
      }
      vehicles={vehicles as never}
      drivers={drivers as never}
      places={places as never}
      bookings={bookings as never}
      accounts={accounts as never}
      initialProofId={proof}
      driverJob={driverJob}
    />
  );
}
