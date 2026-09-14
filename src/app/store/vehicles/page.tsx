import Link from "next/link";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { DriverAvatar } from "@/components/store-admin/fleet/DriverAvatar";
import { FleetStateBadge } from "@/components/store-admin/fleet/FleetStateBadge";
import { VehiclePhoto } from "@/components/store-admin/fleet/VehiclePhoto";
import { requireStoreContext } from "@/lib/auth/tenant";
import {
  fleetVisualLabel,
  fleetVisualState,
  formatDuration,
  isObsoleteTestAsset,
  operationalVehicles,
  ownershipLabel,
} from "@/lib/domain/fleet";
import { currentJobFor, fleetSummary, formatThaiDate, nextJobFor, todayBangkok } from "@/lib/domain/ops";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; layout?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const query = await searchParams;
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const today = todayBangkok();
  const ops = operationalVehicles(board.vehicles);
  const fleet = fleetSummary(board.vehicles, board.drivers, board.bookings, today);
  const filter = query.filter ?? "READY";
  const layout = query.layout ?? "grid";

  const vehicles = board.vehicles.filter((item) => {
    if (filter === "READY" && (isObsoleteTestAsset(item) || !item.active || item.status !== "ACTIVE")) return false;
    if (filter === "OWN" && item.ownershipType !== "OWN") return false;
    if (filter === "PARTNER" && item.ownershipType !== "PARTNER") return false;
    if (filter === "UNAVAILABLE" && item.active && item.status === "ACTIVE" && !isObsoleteTestAsset(item)) return false;
    if (filter === "TEST" && !isObsoleteTestAsset(item)) return false;
    if (filter === "ALL" && isObsoleteTestAsset(item)) return false;
    if (query.q) {
      const hay = `${item.brand} ${item.model} ${item.plateNumber ?? ""}`.toLowerCase();
      if (!hay.includes(query.q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Visual Fleet</p>
          <h1 className="text-2xl font-semibold text-navy-800">รถของร้าน</h1>
        </div>
        <Link href="/store/vehicles/new" className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold leading-10 text-navy-950">
          + เพิ่มรถ
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <Mini label="รถปฏิบัติการ" value={ops.filter((item) => item.active).length} />
        <Mini label="รถว่างวันนี้" value={fleet.vehicles.free} />
        <Mini label="กำลังใช้งาน" value={fleet.vehicles.busy} />
        <Mini label="ไม่พร้อม" value={fleet.vehicles.unavailable} />
      </dl>
      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={query.q} placeholder="ค้นหา" className="admin-input max-w-xs" />
        <select name="filter" defaultValue={filter} className="admin-input max-w-40">
          <option value="READY">พร้อมใช้</option>
          <option value="ALL">รถร้านทั้งหมด</option>
          <option value="OWN">รถร้าน</option>
          <option value="PARTNER">รถทีม</option>
          <option value="UNAVAILABLE">ไม่พร้อม</option>
          <option value="TEST">ข้อมูลทดสอบ Phase 2</option>
        </select>
        <select name="layout" defaultValue={layout} className="admin-input max-w-32">
          <option value="grid">การ์ดใหญ่</option>
          <option value="list">รายการกระชับ</option>
        </select>
        <button className="h-11 rounded-xl bg-navy-800 px-4 text-sm text-white">กรอง</button>
      </form>

      {vehicles.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="ยังไม่มีรถในมุมมองนี้" actionHref="/store/vehicles/new" actionLabel="+ เพิ่มรถ" />
        </div>
      ) : null}

      <div className={layout === "list" ? "mt-6 space-y-3" : "mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3"}>
        {vehicles.map((vehicle) => {
          const state = fleetVisualState(vehicle, board.bookings, "vehicle", today);
          const current = currentJobFor(board.bookings, vehicle.id, "vehicle", today);
          const next = nextJobFor(board.bookings, vehicle.id, "vehicle", today);
          const driver = board.drivers.find((item) => item.id === (current ?? next)?.assignedDriverId);
          const obsolete = isObsoleteTestAsset(vehicle);
          return (
            <article
              key={vehicle.id}
              className={`overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                layout === "list" ? "flex" : ""
              }`}
            >
              <div className={layout === "list" ? "h-28 w-44 shrink-0" : "aspect-[16/10] w-full"}>
                <VehiclePhoto vehicle={vehicle} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-navy-800">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-sm text-muted">{vehicle.plateNumber ?? "ไม่มีทะเบียน"}</p>
                  </div>
                  <FleetStateBadge state={state} label={fleetVisualLabel(state, next)} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-paper px-2 py-1">{ownershipLabel(vehicle.ownershipType)}</span>
                  <span className="rounded-full bg-paper px-2 py-1">{vehicle.seats} ที่นั่ง</span>
                  {obsolete ? <span className="rounded-full bg-line px-2 py-1 text-muted">ข้อมูลทดสอบ</span> : null}
                </div>
                <p className="mt-3 text-sm">
                  {current
                    ? `กำลังใช้งาน · ${current.customerNameSnapshot} · ${formatDuration(current)}`
                    : next
                      ? `งานถัดไป ${formatThaiDate(next.startDate)} ${next.startTime ?? ""}`
                      : "ว่างวันนี้"}
                </p>
                {driver ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <DriverAvatar driver={driver} /> {driver.name}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <Link href="/store/calendar?view=today" className="h-9 rounded-xl bg-navy-800 px-3 text-sm leading-9 text-white">
                    ดูคิวรถ
                  </Link>
                  <Link href={`/store/vehicles/${vehicle.id}`} className="h-9 rounded-xl bg-paper px-3 text-sm leading-9">
                    เปิดรายละเอียด
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium text-navy-800">{value}</dd>
    </div>
  );
}
