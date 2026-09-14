import { ReportRangeBar, ReportsView } from "@/components/store-admin/reports/ReportsView";
import { requireStoreContext } from "@/lib/auth/tenant";
import { operationalBookings } from "@/lib/domain/fixtures";
import {
  buildStoreReport,
  resolveReportRange,
  type ReportPreset,
} from "@/lib/domain/reporting";
import { permissionsForRole } from "@/lib/domain/staff-permissions";

export const dynamic = "force-dynamic";

const PRESETS: ReportPreset[] = ["today", "last7", "thisMonth", "lastMonth", "thisYear", "custom"];

export default async function StoreReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const ctx = await requireStoreContext();
  if (!ctx.businessId) return <p>บัญชีนี้ยังไม่มีร้าน</p>;

  const staff = await ctx.store.listStaff(ctx.actor, ctx.businessId);
  const me = staff.find((item) => item.userId === ctx.session.userId && item.active);
  const permissions =
    ctx.session.role === "SUPER_ADMIN"
      ? permissionsForRole("OWNER")
      : me?.staffRole === "OWNER"
        ? permissionsForRole("OWNER")
        : (me?.permissions ?? []);
  if (!permissions.includes("REPORT_VIEW")) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-muted">
        ไม่มีสิทธิ์ดูรายงานร้าน (ต้องการ REPORT_VIEW)
      </div>
    );
  }

  const query = await searchParams;
  const preset = (PRESETS.includes(query.range as ReportPreset) ? query.range : "thisMonth") as ReportPreset;
  const range = resolveReportRange(preset, query.start, query.end);

  const board = await ctx.store.loadTenantBoard(ctx.actor, ctx.businessId);
  const movements = await ctx.store.listMoneyMovements(ctx.actor, ctx.businessId);
  const proofs = await ctx.store.listPaymentProofs(ctx.actor, ctx.businessId);
  const quotations = await ctx.store.listQuotations(ctx.actor, ctx.businessId);

  const report = buildStoreReport({
    businessId: ctx.businessId,
    range,
    bookings: operationalBookings(board.bookings),
    vehicles: board.vehicles,
    drivers: board.drivers,
    customers: board.customers,
    movements,
    quotations,
    proofs,
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted">วิเคราะห์ธุรกิจร้าน</p>
        <h1 className="text-2xl font-semibold text-navy-800">รายงานร้าน</h1>
        <p className="mt-1 text-sm text-muted">
          นับเงินจากรายการรับ-จ่ายที่อนุมัติแล้วเท่านั้น · ทิปแยกจากรายรับค่าบริการ
        </p>
      </div>
      <ReportRangeBar preset={range.preset} start={range.start} end={range.end} label={range.label} />
      <ReportsView report={report} />
    </div>
  );
}
