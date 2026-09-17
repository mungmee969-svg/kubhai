import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { BookingFilterBar } from "@/components/store-admin/booking/BookingFilterBar";
import { BookingInboxCard } from "@/components/store-admin/booking/BookingInboxCard";
import { requireStoreContext } from "@/lib/auth/tenant";
import { listDurableStoreBookings } from "@/lib/data/supabase-store-booking";
import {
  OPS_INBOX_FILTERS,
  resolveBookingNextAction,
} from "@/lib/domain/booking-ops-next";
import { matchesBookingFilter } from "@/lib/domain/booking-filters";
import { operationalBookings } from "@/lib/domain/fixtures";
import { todayBangkok } from "@/lib/domain/ops";
import { listQuotationAttention, quotationAttention } from "@/lib/domain/quotation";
import { attentionReason, settleBooking } from "@/lib/domain/settlement";
import { BOOKING_STATUSES } from "@/lib/domain/enums";

export const dynamic = "force-dynamic";

export default async function BookingsWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    date?: string;
    vehicle?: string;
    driver?: string;
    source?: string;
  }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const query = await searchParams;
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const durableBookings = await listDurableStoreBookings(ctx.businessId);
  const movements = await ctx.store.listMoneyMovements(ctx.actor, ctx.businessId);
  const proofs = await ctx.store.listPaymentProofs(ctx.actor, ctx.businessId);
  const quotations = await ctx.store.listQuotations(ctx.actor, ctx.businessId);
  const pendingProofIds = new Set(
    proofs.filter((item) => item.reviewStatus === "PENDING_REVIEW").map((item) => item.bookingId),
  );
  const today = todayBangkok();
  const filter = query.filter ?? "NEW";

  // Durable production bookings are already tenant-locked by the server-side
  // store credential. Keep the business-id check here as defense in depth and
  // de-duplicate against local fixtures during the rollout.
  const mergedBookings = new Map(board.bookings.map((booking) => [booking.id, booking]));
  for (const booking of durableBookings) {
    if (booking.businessId === ctx.businessId) mergedBookings.set(booking.id, booking);
  }
  const visibleBookings = operationalBookings([...mergedBookings.values()]);
  const settled = visibleBookings.map((booking) => {
    const bookingQuotes = quotations.filter((item) => item.bookingId === booking.id);
    const settlement = settleBooking(
      booking,
      movements.filter((item) => item.bookingId === booking.id),
    );
    const pendingProof = pendingProofIds.has(booking.id);
    const quoteAction = quotationAttention(bookingQuotes, booking);
    const next = resolveBookingNextAction(booking, bookingQuotes, settlement, {
      pendingProof,
      quotationAttention: quoteAction,
    });
    return {
      booking,
      settlement,
      pendingProof,
      quoteAttention: listQuotationAttention(bookingQuotes, booking),
      quoteAction,
      next,
      reason: attentionReason(booking, settlement, { pendingProof, quotationAttention: quoteAction }),
    };
  });

  const counts: Record<string, number> = {
    ALL: visibleBookings.length,
    NEW: settled.filter((item) =>
      matchesBookingFilter(item.booking, item.settlement, "NEW", today, {
        pendingProof: item.pendingProof,
        quotationAttention: item.quoteAction,
        quotations: quotations.filter((q) => q.bookingId === item.booking.id),
      }),
    ).length,
    ACTION: settled.filter((item) =>
      matchesBookingFilter(item.booking, item.settlement, "ACTION", today, {
        pendingProof: item.pendingProof,
        quotationAttention: item.quoteAction,
        quotations: quotations.filter((q) => q.bookingId === item.booking.id),
      }),
    ).length,
    REVIEW: settled.filter((item) => item.pendingProof).length,
    WAITING_CUSTOMER: settled.filter((item) =>
      matchesBookingFilter(item.booking, item.settlement, "WAITING_CUSTOMER", today, {
        pendingProof: item.pendingProof,
        quotationAttention: item.quoteAction,
        quotations: quotations.filter((q) => q.bookingId === item.booking.id),
      }),
    ).length,
    CONFIRMED: settled.filter((item) =>
      ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(item.booking.status),
    ).length,
    TODAY: visibleBookings.filter((item) => item.startDate === today).length,
    NO_VEHICLE: settled.filter((item) =>
      matchesBookingFilter(item.booking, item.settlement, "NO_VEHICLE", today),
    ).length,
    NO_DRIVER: settled.filter((item) =>
      matchesBookingFilter(item.booking, item.settlement, "NO_DRIVER", today),
    ).length,
    WAITING_BALANCE: settled.filter((item) => item.settlement.state === "WAITING_BALANCE").length,
  };
  for (const status of BOOKING_STATUSES) {
    counts[status] = visibleBookings.filter((item) => item.status === status).length;
  }

  const rows = settled.filter(({ booking, settlement, pendingProof, quoteAction }) => {
    const bookingQuotes = quotations.filter((item) => item.bookingId === booking.id);
    if (
      !matchesBookingFilter(booking, settlement, filter, today, {
        pendingProof,
        quotationAttention: quoteAction,
        quotations: bookingQuotes,
      })
    ) {
      return false;
    }
    if (query.date && booking.startDate !== query.date) return false;
    if (query.vehicle && booking.assignedVehicleId !== query.vehicle) return false;
    if (query.driver && booking.assignedDriverId !== query.driver) return false;
    if (query.source && booking.source !== query.source) return false;
    if (query.q) {
      const hay =
        `${booking.bookingCode} ${booking.customerNameSnapshot} ${booking.customerPhoneSnapshot} ${booking.pickupLocation} ${booking.dropoffLocation ?? ""}`.toLowerCase();
      if (!hay.includes(query.q.toLowerCase())) return false;
    }
    return true;
  });

  const emptyTitle =
    filter === "NEW"
      ? "ยังไม่มีคำขอใหม่"
      : filter === "ACTION"
        ? "ไม่มีงานที่ต้องจัดการตอนนี้"
        : "ไม่มี Booking ในมุมมองนี้";

  return (
    <div className="pb-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-[color:var(--store-primary,#0F3D3E)]">งานจอง</h1>
        <p className="mt-1 text-sm text-muted">จัดการคำขอและงานของร้าน</p>
      </header>

      <BookingFilterBar
        filter={filter}
        counts={counts}
        query={query}
        vehicles={board.vehicles}
        drivers={board.drivers}
      />

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? <EmptyState title={emptyTitle} /> : null}
        {rows.map(({ booking, reason, next, quoteAttention }) => (
          <BookingInboxCard
            key={booking.id}
            booking={booking}
            attention={
              reason ??
              (next.kind === "ASSIGN" || next.kind === "REVIEW_AND_ASSIGN"
                ? "ยังไม่ได้จัดรถและคนขับ"
                : quoteAttention || null)
            }
            nextCtaLabel={next.ctaLabel}
          />
        ))}
      </div>

      {rows.length > 0 ? (
        <p className="mt-6 hidden text-center text-xs text-muted lg:block">
          แสดงเป็นบัตรงาน · {OPS_INBOX_FILTERS.find((item) => item.key === filter)?.label ?? filter}
        </p>
      ) : null}
    </div>
  );
}
