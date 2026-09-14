import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VehicleForm } from "@/components/store-admin/VehicleForm";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { DriverAvatar } from "@/components/store-admin/fleet/DriverAvatar";
import { FleetStateBadge } from "@/components/store-admin/fleet/FleetStateBadge";
import { VehiclePhoto } from "@/components/store-admin/fleet/VehiclePhoto";
import { requireStoreContext } from "@/lib/auth/tenant";
import {
  datesInRange,
  fleetVisualLabel,
  fleetVisualState,
  formatDuration,
  isObsoleteTestAsset,
  overlapsDate,
  ownershipLabel,
} from "@/lib/domain/fleet";
import { addDays, currentJobFor, formatThaiDate, nextJobFor, todayBangkok } from "@/lib/domain/ops";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
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
  const vehicle = board.vehicles.find((item) => item.id === id);
  if (!vehicle) notFound();
  const today = todayBangkok();
  const state = fleetVisualState(vehicle, board.bookings, "vehicle", today);
  const current = currentJobFor(board.bookings, vehicle.id, "vehicle", today);
  const next = nextJobFor(board.bookings, vehicle.id, "vehicle", today);
  const jobs = board.bookings
    .filter((item) => item.assignedVehicleId === vehicle.id)
    .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`));
  const upcoming = jobs.filter((item) => item.startDate >= today && item.status !== "CANCELLED" && item.status !== "REJECTED");
  const history = jobs.filter((item) => item.status === "COMPLETED" || item.startDate < today);
  const currentDriver = board.drivers.find((item) => item.id === (current ?? next)?.assignedDriverId);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-white">
        <div className="aspect-[16/7] w-full">
          <VehiclePhoto vehicle={vehicle} />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div>
            <p className="text-xs text-muted">{ownershipLabel(vehicle.ownershipType)}</p>
            <h1 className="text-2xl font-semibold text-navy-800">
              {vehicle.brand} {vehicle.model}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {vehicle.plateNumber ?? "ไม่มีทะเบียน"} · {vehicle.seats} ที่นั่ง
            </p>
            {isObsoleteTestAsset(vehicle) ? <p className="mt-2 text-xs text-muted">ข้อมูลทดสอบ Phase 2 — ไม่นับในคิวปฏิบัติการ</p> : null}
          </div>
          <FleetStateBadge state={state} label={fleetVisualLabel(state, next)} />
        </div>
      </div>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-navy-800">วันนี้</h2>
        {current ? (
          <Link href={`/store/bookings/${current.id}`} className="mt-3 block rounded-xl bg-paper p-3">
            <p className="text-xs text-muted">งานปัจจุบัน</p>
            <p className="font-medium">{current.bookingCode} · {current.customerNameSnapshot}</p>
            <p className="text-sm">
              {current.pickupLocation}
              {current.dropoffLocation ? ` → ${current.dropoffLocation}` : ""} · {formatDuration(current)}
            </p>
          </Link>
        ) : (
          <p className="mt-2 text-sm text-muted">ยังไม่มีงานที่กำลังใช้งานวันนี้</p>
        )}
        {next && next.id !== current?.id ? (
          <p className="mt-3 text-sm">
            งานถัดไป {formatThaiDate(next.startDate)} {next.startTime ?? ""} · {next.customerNameSnapshot}
          </p>
        ) : null}
        {currentDriver ? (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <DriverAvatar driver={currentDriver} size="md" /> {currentDriver.name}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">ยังไม่มีคนขับผูกกับงานนี้</p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-navy-800">ตาราง 14 วัน</h2>
        <div className="mt-3 overflow-x-auto">
          <div className="grid min-w-[920px] gap-1 text-center text-[11px]" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
            {datesInRange(today, addDays(today, 13)).map((day) => {
              const dayJobs = jobs.filter((item) => overlapsDate(item, day) && item.status !== "CANCELLED");
              return (
                <div key={day} className={`rounded-xl px-1 py-2 ${dayJobs.length ? "bg-navy-800 text-white" : "bg-paper text-muted"}`}>
                  <p>{formatThaiDate(day)}</p>
                  <p className="mt-1 font-medium">{dayJobs.length ? dayJobs[0].customerNameSnapshot : "ว่าง"}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-navy-800">ตารางงาน / งานถัดไป</h2>
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 ? <EmptyState title="ยังไม่มีงานในตาราง" /> : null}
          {upcoming.map((booking) => {
            const driver = board.drivers.find((item) => item.id === booking.assignedDriverId);
            return (
              <Link key={booking.id} href={`/store/bookings/${booking.id}`} className="block rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">
                      {formatThaiDate(booking.startDate)} {booking.startTime ?? ""} · {formatDuration(booking)}
                    </p>
                    <p className="font-medium">
                      {booking.bookingCode} · {booking.customerNameSnapshot}
                    </p>
                    <p className="text-sm">
                      {booking.pickupLocation}
                      {booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}
                    </p>
                    {driver ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <DriverAvatar driver={driver} /> {driver.name}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-navy-800">ประวัติ</h2>
        <div className="mt-3 space-y-2">
          {history.slice(0, 20).map((booking) => (
            <Link key={booking.id} href={`/store/bookings/${booking.id}`} className="block rounded-2xl bg-white p-4 text-sm">
              {formatThaiDate(booking.startDate)} · {booking.bookingCode} · {booking.customerNameSnapshot} · {formatDuration(booking)}
            </Link>
          ))}
          {history.length === 0 ? <p className="text-sm text-muted">ยังไม่มีประวัติ</p> : null}
        </div>
      </section>

      {edit ? (
        <section>
          <h2 className="mb-3 font-semibold text-navy-800">แก้ไขรถ</h2>
          <VehicleForm businessId={ctx.businessId} vehicle={vehicle} />
        </section>
      ) : (
        <Link href={`/store/vehicles/${vehicle.id}?edit=1`} className="inline-flex h-10 items-center rounded-xl bg-navy-800 px-4 text-sm text-white">
          แก้ไขข้อมูลรถ
        </Link>
      )}
    </div>
  );
}
