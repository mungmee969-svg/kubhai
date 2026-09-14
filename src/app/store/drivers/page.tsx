import Link from "next/link";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { ActiveToggle } from "@/components/store-admin/ui/ActiveToggle";
import { DriverAvatar } from "@/components/store-admin/fleet/DriverAvatar";
import { FleetStateBadge } from "@/components/store-admin/fleet/FleetStateBadge";
import { requireStoreContext } from "@/lib/auth/tenant";
import { fleetVisualLabel, fleetVisualState, formatDuration, isObsoleteTestAsset } from "@/lib/domain/fleet";
import { fleetSummary, formatThaiDate, nextJobFor, todayBangkok } from "@/lib/domain/ops";

export const dynamic = "force-dynamic";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;
  const query = await searchParams;
  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const today = todayBangkok();
  const fleet = fleetSummary(board.vehicles, board.drivers, board.bookings, today);
  const filter = query.filter ?? "READY";

  const drivers = board.drivers.filter((item) => {
    if (filter === "READY" && (isObsoleteTestAsset(item) || !item.active || item.status !== "ACTIVE")) return false;
    if (filter === "INTERNAL" && item.driverType !== "INTERNAL") return false;
    if (filter === "PARTNER" && item.driverType !== "PARTNER") return false;
    if (filter === "UNAVAILABLE" && item.active && item.status === "ACTIVE" && !isObsoleteTestAsset(item)) return false;
    if (filter === "TEST" && !isObsoleteTestAsset(item)) return false;
    if (filter === "ALL" && isObsoleteTestAsset(item)) return false;
    if (query.q) {
      const hay = `${item.name} ${item.nickname ?? ""} ${item.phone ?? ""}`.toLowerCase();
      if (!hay.includes(query.q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-navy-800">คนขับ</h1>
        <Link href="/store/drivers/new" className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold leading-10 text-navy-950">
          + เพิ่มคนขับ
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <Mini label="ทั้งหมด" value={fleet.drivers.total} />
        <Mini label="ว่างวันนี้" value={fleet.drivers.free} />
        <Mini label="มีงาน" value={fleet.drivers.busy} />
        <Mini label="ไม่พร้อม" value={fleet.drivers.unavailable} />
      </dl>
      <form className="mt-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={query.q} placeholder="ค้นหา" className="admin-input max-w-xs" />
        <select name="filter" defaultValue={filter} className="admin-input max-w-40">
          <option value="READY">พร้อมใช้</option>
          <option value="ALL">คนขับร้านทั้งหมด</option>
          <option value="INTERNAL">คนขับร้าน</option>
          <option value="PARTNER">คนขับทีม</option>
          <option value="UNAVAILABLE">ไม่พร้อม</option>
          <option value="TEST">ข้อมูลทดสอบ Phase 2</option>
        </select>
        <button className="h-11 rounded-xl bg-navy-800 px-4 text-sm text-white">กรอง</button>
      </form>
      <div className="mt-4 space-y-3">
        {drivers.length === 0 ? (
          <EmptyState title="ยังไม่มีคนขับ" actionHref="/store/drivers/new" actionLabel="+ เพิ่มคนขับ" />
        ) : null}
        {drivers.map((driver) => {
          const state = fleetVisualState(driver, board.bookings, "driver", today);
          const next = nextJobFor(board.bookings, driver.id, "driver", today);
          return (
            <article key={driver.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4">
              <DriverAvatar driver={driver} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-800">{driver.name}</p>
                <p className="text-sm text-muted">
                  {driver.phone ?? "ไม่มีเบอร์"} · {driver.driverType}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {next
                    ? `งานถัดไป ${next.bookingCode} · ${formatThaiDate(next.startDate)} · ${formatDuration(next)}`
                    : "ยังไม่มีงานถัดไป"}
                </p>
                {isObsoleteTestAsset(driver) ? <p className="text-xs text-muted">ข้อมูลทดสอบ Phase 2</p> : null}
              </div>
              <FleetStateBadge state={state} label={fleetVisualLabel(state, next)} />
              <div className="flex gap-3 text-sm">
                <Link href={`/store/drivers/${driver.id}`} className="text-navy-800">
                  ดู
                </Link>
                <Link href={`/store/drivers/${driver.id}?edit=1`} className="text-navy-800">
                  แก้ไข
                </Link>
                <ActiveToggle kind="driver" id={driver.id} active={driver.active} />
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
