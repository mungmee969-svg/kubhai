import { DispatchBoard, type DispatchView } from "@/components/store-admin/fleet/DispatchBoard";
import { requireStoreContext } from "@/lib/auth/tenant";
import { operationalBookings } from "@/lib/domain/fixtures";
import { weekStartMonday } from "@/lib/domain/fleet";
import { todayBangkok } from "@/lib/domain/ops";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const query = await searchParams;
  const today = todayBangkok();
  const rawView = query.view === "tomorrow" ? "today" : query.view;
  const view = (["today", "week", "month", "list"].includes(rawView ?? "")
    ? rawView
    : "today") as DispatchView;
  const date =
    query.date ??
    (view === "week" ? weekStartMonday(today) : view === "month" ? `${today.slice(0, 7)}-01` : today);
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const [dayLogs, driverLinks] = await Promise.all([
    ctx.store.listDriverDayLogs(ctx.actor, ctx.businessId),
    ctx.store.listDriverJobLinks(ctx.actor, ctx.businessId),
  ]);

  return (
    <DispatchBoard
      date={date}
      today={today}
      view={view}
      bookings={operationalBookings(board.bookings)}
      vehicles={board.vehicles}
      drivers={board.drivers}
      dayLogs={dayLogs}
      driverLinks={driverLinks}
    />
  );
}
