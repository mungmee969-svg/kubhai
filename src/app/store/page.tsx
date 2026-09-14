import { OwnerDashboard } from "@/components/store-admin/dashboard/OwnerDashboard";
import { requireStoreContext } from "@/lib/auth/tenant";
import { resolveBookingNextAction } from "@/lib/domain/booking-ops-next";
import { operationalBookings } from "@/lib/domain/fixtures";
import { actionQueue, todayBangkok } from "@/lib/domain/ops";
import {
  buildStoreReport,
  resolveReportRange,
  type ReportPreset,
} from "@/lib/domain/reporting";
import { settleBooking } from "@/lib/domain/settlement";
import { permissionsForRole } from "@/lib/domain/staff-permissions";

export const dynamic = "force-dynamic";

const PRESETS: ReportPreset[] = ["today", "last7", "thisMonth", "lastMonth", "thisYear", "custom"];

export default async function StoreDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId || !ctx.business) return <p>บัญชีนี้ยังไม่มีร้าน</p>;

  const query = await searchParams;
  const preset = (PRESETS.includes(query.range as ReportPreset) ? query.range : "thisMonth") as ReportPreset;
  const range = resolveReportRange(preset, query.start, query.end);

  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const movements = await ctx.store.listMoneyMovements(ctx.actor, ctx.businessId);
  const proofs = await ctx.store.listPaymentProofs(ctx.actor, ctx.businessId);
  const quotations = await ctx.store.listQuotations(ctx.actor, ctx.businessId);
  const staff = await ctx.store.listStaff(ctx.actor, ctx.businessId);
  const me = staff.find((item) => item.userId === ctx.session.userId && item.active);
  const permissions =
    ctx.session.role === "SUPER_ADMIN"
      ? permissionsForRole("OWNER")
      : me?.staffRole === "OWNER"
        ? permissionsForRole("OWNER")
        : (me?.permissions ?? []);
  const canViewFinance = permissions.includes("FINANCE_VIEW") || permissions.includes("REPORT_VIEW");
  const canViewReports = permissions.includes("REPORT_VIEW");

  const today = todayBangkok();
  const bookings = operationalBookings(board.bookings);
  const queue = actionQueue(bookings);
  const pendingSlips = proofs.filter(
    (item) => item.reviewStatus === "PENDING_REVIEW" && bookings.some((booking) => booking.id === item.bookingId),
  ).length;
  const settlements = bookings.map((booking) =>
    settleBooking(
      booking,
      movements.filter((item) => item.bookingId === booking.id),
    ),
  );
  const outstandingCount = settlements.filter((item) => (item.remainingBalance ?? 0) > 0).length;
  const needQuote = bookings.filter((booking) => {
    const settlement = settleBooking(
      booking,
      movements.filter((item) => item.bookingId === booking.id),
    );
    const quotes = quotations.filter((item) => item.bookingId === booking.id);
    const next = resolveBookingNextAction(booking, quotes, settlement);
    return next.kind === "CREATE_OFFER" || next.kind === "SEND_OFFER";
  }).length;
  const waitingCustomer = queue.QUOTATION_SENT + queue.WAITING_DEPOSIT;

  const report = buildStoreReport({
    businessId: ctx.businessId,
    range,
    bookings,
    vehicles: board.vehicles,
    drivers: board.drivers,
    customers: board.customers,
    movements,
    quotations,
    proofs,
  });

  return (
    <OwnerDashboard
      slug={ctx.business.slug}
      report={report}
      attention={{
        REQUESTED: queue.REQUESTED,
        NEED_QUOTE: needQuote,
        WAITING_CUSTOMER: waitingCustomer,
        NO_VEHICLE: queue.NO_VEHICLE,
        NO_DRIVER: queue.NO_DRIVER,
        PENDING_SLIP: pendingSlips,
        OUTSTANDING: outstandingCount,
      }}
      canViewFinance={canViewFinance}
      canViewReports={canViewReports}
      today={today}
      bookings={bookings}
      vehicles={board.vehicles}
      drivers={board.drivers}
    />
  );
}
