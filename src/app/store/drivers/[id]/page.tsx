import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DriverForm } from "@/components/store-admin/DriverForm";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { DriverAvatar } from "@/components/store-admin/fleet/DriverAvatar";
import { FleetStateBadge } from "@/components/store-admin/fleet/FleetStateBadge";
import { requireStoreContext } from "@/lib/auth/tenant";
import { fleetVisualLabel, fleetVisualState, formatDuration, isObsoleteTestAsset } from "@/lib/domain/fleet";
import { formatThaiDate, todayBangkok } from "@/lib/domain/ops";

export const dynamic = "force-dynamic";

export default async function DriverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const { id } = await params;
  const edit = (await searchParams).edit === "1";
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const driver = board.drivers.find((item) => item.id === id);
  if (!driver) notFound();
  const today = todayBangkok();
  const jobs = board.bookings
    .filter((item) => item.assignedDriverId === driver.id)
    .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`));
  const todayJob = jobs.find((item) => item.startDate === today && item.status !== "CANCELLED");
  const upcoming = jobs.filter((item) => item.startDate >= today && item.status !== "CANCELLED" && item.status !== "REJECTED");
  const history = jobs.filter((item) => item.startDate < today || item.status === "COMPLETED");
  const state = fleetVisualState(driver, board.bookings, "driver", today);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <DriverAvatar driver={driver} size="md" />
        <div>
          <h1 className="text-2xl font-semibold text-navy-800">{driver.name}</h1>
          <p className="text-sm text-muted">
            {driver.phone ?? "ไม่มีเบอร์"} · {driver.driverType}
          </p>
          {isObsoleteTestAsset(driver) ? (
            <p className="mt-1 text-xs text-muted">ข้อมูลทดสอบ Phase 2 — ไม่นับในคิวปฏิบัติการ</p>
          ) : null}
        </div>
        <FleetStateBadge state={state} label={fleetVisualLabel(state, todayJob ?? null)} />
      </div>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-navy-800">งานวันนี้</h2>
        {todayJob ? (
          <Link href={`/store/bookings/${todayJob.id}`} className="mt-2 block text-sm">
            {todayJob.bookingCode} · {todayJob.startTime ?? "ทั้งวัน"} · {todayJob.pickupLocation} · {formatDuration(todayJob)}
          </Link>
        ) : (
          <p className="mt-2 text-sm text-muted">ยังไม่มีงานวันนี้</p>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-navy-800">งานถัดไป</h2>
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 ? <EmptyState title="ยังไม่มีงานถัดไป" /> : null}
          {upcoming.map((booking) => (
            <Link key={booking.id} href={`/store/bookings/${booking.id}`} className="block rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">
                    {formatThaiDate(booking.startDate)} {booking.startTime ?? ""} · {formatDuration(booking)}
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
          {history.slice(0, 20).map((booking) => (
            <Link key={booking.id} href={`/store/bookings/${booking.id}`} className="block rounded-2xl bg-white p-4 text-sm">
              {formatThaiDate(booking.startDate)} · {booking.bookingCode}
            </Link>
          ))}
          {history.length === 0 ? <p className="text-sm text-muted">ยังไม่มีประวัติ</p> : null}
        </div>
      </section>

      {edit ? (
        <section>
          <h2 className="mb-3 font-semibold text-navy-800">แก้ไขคนขับ</h2>
          <DriverForm businessId={ctx.businessId} driver={driver} />
        </section>
      ) : (
        <Link href={`/store/drivers/${driver.id}?edit=1`} className="inline-flex h-10 items-center rounded-xl bg-navy-800 px-4 text-sm text-white">
          แก้ไขข้อมูลคนขับ
        </Link>
      )}
    </div>
  );
}
