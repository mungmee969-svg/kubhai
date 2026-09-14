"use client";

import Link from "next/link";
import {
  DualBars,
  Funnel,
  MetricCard,
  OwnPartnerDonut,
  ReportRangeBar,
  SimpleBars,
} from "@/components/store-admin/reports/ReportsView";
import { StorefrontLinkActions } from "@/components/store-admin/shell/StorefrontLinkActions";
import { EmptyState } from "@/components/store-admin/ui/EmptyState";
import { DispatchBoard } from "@/components/store-admin/fleet/DispatchBoard";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";
import type { StoreReport } from "@/lib/domain/reporting";
import type { Booking, Driver, Vehicle } from "@/lib/domain/types";

const ATTENTION_ITEMS = [
  ["REQUESTED", "คำขอใหม่", "/store/bookings?filter=NEW"],
  ["NEED_QUOTE", "ต้องออกใบเสนอราคา", "/store/bookings?filter=ACTION"],
  ["WAITING_CUSTOMER", "รอลูกค้ายืนยัน", "/store/bookings?filter=WAITING_CUSTOMER"],
  ["NO_VEHICLE", "ยังไม่มีรถ", "/store/bookings?filter=NO_VEHICLE"],
  ["NO_DRIVER", "ยังไม่มีคนขับ", "/store/bookings?filter=NO_DRIVER"],
  ["PENDING_SLIP", "รอตรวจสลิป", "/store/finance?filter=SLIP_REVIEW"],
  ["OUTSTANDING", "ยอดค้าง", "/store/finance?filter=RECEIVABLE"],
] as const;

export type DashboardAttention = Record<(typeof ATTENTION_ITEMS)[number][0], number>;

type Props = {
  slug: string;
  report: StoreReport;
  attention: DashboardAttention;
  canViewFinance: boolean;
  canViewReports: boolean;
  today: string;
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
};

export function OwnerDashboard({
  slug,
  report,
  attention,
  canViewFinance,
  canViewReports,
  today,
  bookings,
  vehicles,
  drivers,
}: Props) {
  const salesBars = report.charts.salesByDay.map((item) => ({
    date: item.date,
    in: item.sales,
    out: item.received,
  }));
  const bookingBars = report.charts.bookingsByDay.map((item) => ({
    label: formatThaiDate(item.date),
    count: item.count,
  }));
  const serviceBars = report.charts.serviceMix.map((item) => ({
    label: item.label,
    count: item.count,
  }));
  const paymentBars = report.charts.paymentMix.map((item) => ({
    label: item.method,
    count: item.amount,
  }));
  const vehicleRank = [...report.own.perVehicle, ...report.partner.perVehicle]
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 5)
    .map((row) => ({
      label: `${row.vehicle.brand} ${row.vehicle.model}`,
      count: row.jobs,
    }));
  const topDrivers = report.drivers.slice(0, 5).map((row) => ({
    label: row.driver.name,
    count: row.jobs,
  }));
  const topRoutes = report.routes.slice(0, 5).map((row) => ({
    label: row.route,
    count: row.count,
  }));
  const outstandingTop = report.outstanding.receivableRows.slice(0, 5);
  const attentionActive = ATTENTION_ITEMS.filter(([key]) => attention[key] > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">ภาพรวมธุรกิจร้าน</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy-800">ภาพรวมร้าน</h1>
        </div>
        {canViewReports ? (
          <Link href={`/store/reports?range=${report.range.preset}`} className="text-sm font-medium text-accent-deep">
            ดูรายงานทั้งหมด →
          </Link>
        ) : null}
      </div>

      <StorefrontLinkActions slug={slug} variant="bar" />

      <ReportRangeBar
        preset={report.range.preset}
        start={report.range.start}
        end={report.range.end}
        label={report.range.label}
        basePath="/store"
      />

      <section>
        <h2 className="text-sm font-semibold text-navy-800">วันนี้ต้องทำอะไร?</h2>
        {attentionActive.length === 0 ? (
          <div className="mt-2">
            <EmptyState title="ไม่มีงานค้างตอนนี้" hint="คำขอใหม่หรืองานที่ต้องจัดการจะขึ้นที่นี่" />
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {attentionActive.map(([key, label, href]) => (
              <Link
                key={key}
                href={href}
                className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-white px-3 py-2 text-sm text-navy-800"
              >
                <span>{label}</span>
                <span className="rounded-full bg-navy-800 px-2 py-0.5 text-xs font-semibold text-white">
                  {attention[key]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {canViewFinance ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="ยอดงาน" value={String(report.overview.bookings)} />
          <MetricCard
            label="ยอดขาย (ใบเสนอที่ลูกค้ายืนยัน)"
            value={formatMoney(report.quotation.acceptedSalesTotal)}
            hint={
              report.quotation.accepted
                ? `${report.quotation.accepted} ใบ · ค่าเฉลี่ย ${formatMoney(report.quotation.avgAcceptedValue ?? 0)}`
                : "ยังไม่มีใบที่ยืนยันในช่วงนี้"
            }
          />
          <MetricCard label="รับเงินแล้ว" value={formatMoney(report.overview.serviceRevenue)} hint="ไม่รวมทิป · เฉพาะรายการอนุมัติ" />
          <MetricCard
            label="ยอดค้างรับ"
            value={formatMoney(report.outstanding.receivableAmount)}
            hint={`${report.outstanding.receivableCount} งาน`}
          />
          <MetricCard label="เงินจ่าย/ค่าใช้จ่ายที่บันทึกแล้ว" value={formatMoney(report.overview.operationalPayouts)} hint="ไม่รวมส่งต่อทิป" />
          <MetricCard
            label="ผลต่างรับ-จ่าย"
            value={formatMoney(report.overview.cashDifference)}
            hint={report.help.cashDifference}
          />
          <MetricCard label="ทิปที่รับ" value={formatMoney(report.overview.tipReceived)} hint="แยกจากยอดขาย/รับเงินบริการ" />
        </section>
      ) : (
        <section className="rounded-2xl bg-white p-4 text-sm text-muted">
          บัญชีนี้ไม่มีสิทธิ์ดูตัวเลขการเงิน — แสดงเฉพาะงานที่ต้องจัดการและคิววันนี้
        </section>
      )}

      {canViewFinance ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="งานเสร็จ" value={String(report.overview.completed)} />
          <MetricCard label="ยกเลิก/ปฏิเสธ" value={String(report.overview.cancelled)} />
          <MetricCard label="ลูกค้าใหม่" value={String(report.customers.newCustomers)} />
          <MetricCard label="ลูกค้าซ้ำ" value={String(report.customers.returningCustomers)} hint={report.help.repeat} />
        </section>
      ) : null}

      {canViewFinance ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <h2 className="font-semibold text-navy-800">ยอดขายและเงินรับ</h2>
            <p className="mt-1 text-xs text-muted">ยอดขาย = ใบเสนอที่ลูกค้ายืนยัน · เงินรับ = มัดจำ/ค่าบริการที่อนุมัติ</p>
            <div className="mt-3">
              <DualBars items={salesBars} inLabel="ขาย" outLabel="รับ" />
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-muted">
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-navy-800" />
                ยอดขาย
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />
                เงินรับ
              </span>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <h2 className="font-semibold text-navy-800">จำนวนงานตามวัน</h2>
            <div className="mt-3">
              <SimpleBars items={bookingBars} />
            </div>
          </div>
        </section>
      ) : null}

      {canViewFinance ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <h2 className="font-semibold text-navy-800">สัดส่วนบริการ</h2>
            <div className="mt-3">
              <SimpleBars items={serviceBars} />
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <h2 className="font-semibold text-navy-800">ช่องทางรับเงิน</h2>
            <p className="mt-1 text-xs text-muted">เฉพาะรายการอนุมัติ · ไม่รวมทิป</p>
            <div className="mt-3">
              <SimpleBars items={paymentBars} valueKey="count" />
            </div>
          </div>
        </section>
      ) : null}

      {canViewFinance ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-navy-800">ยอดค้างรับ</h2>
              <Link href="/store/finance?filter=RECEIVABLE" className="text-sm font-medium text-accent-deep">
                ดูยอดค้างทั้งหมด
              </Link>
            </div>
            <p className="mt-2 text-2xl font-semibold text-navy-800">
              {formatMoney(report.outstanding.receivableAmount)}
            </p>
            <p className="text-xs text-muted">{report.outstanding.receivableCount} งาน</p>
            <ul className="mt-3 space-y-2">
              {outstandingTop.length === 0 ? (
                <li className="text-sm text-muted">ไม่มียอดค้าง</li>
              ) : (
                outstandingTop.map((row) => (
                  <li key={row.id}>
                    <Link href={row.href ?? "#"} className="block rounded-xl bg-paper px-3 py-2 text-sm hover:bg-white">
                      <p className="font-medium text-navy-800">{row.label}</p>
                      <p className="text-xs text-muted">{row.sublabel}</p>
                      <p className="mt-0.5 text-xs">{formatMoney(row.amount ?? 0)}</p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <h2 className="font-semibold text-navy-800">Funnel ใบเสนอราคา</h2>
            <div className="mt-3">
              <Funnel steps={report.booking.funnel} />
            </div>
          </div>
        </section>
      ) : null}

      {canViewFinance ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <h2 className="font-semibold text-navy-800">รถ / รอบงาน</h2>
            <p className="mt-1 text-xs text-muted">
              รถที่ออกงาน {report.own.vehiclesUsed + report.partner.vehiclesUsed} คัน ·{" "}
              {report.own.jobs + report.partner.jobs} รอบ
            </p>
            <div className="mt-3">
              <OwnPartnerDonut ownJobs={report.own.jobs} partnerJobs={report.partner.jobs} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-paper px-3 py-2">
                <dt className="text-xs text-muted">OWN</dt>
                <dd className="font-medium">
                  {report.own.jobs} งาน · {formatMoney(report.own.serviceValue)}
                </dd>
              </div>
              <div className="rounded-xl bg-paper px-3 py-2">
                <dt className="text-xs text-muted">PARTNER</dt>
                <dd className="font-medium">
                  {report.partner.jobs} งาน · {formatMoney(report.partner.serviceValue)}
                </dd>
                {report.partner.partnerPaid > 0 ? (
                  <dd className="text-[11px] text-muted">จ่ายพาร์ทเนอร์ {formatMoney(report.partner.partnerPaid)}</dd>
                ) : null}
              </div>
            </dl>
            <div className="mt-3">
              <SimpleBars items={vehicleRank} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4">
              <h2 className="font-semibold text-navy-800">คนขับที่มีงานมาก</h2>
              <div className="mt-3">
                <SimpleBars items={topDrivers} />
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <h2 className="font-semibold text-navy-800">ลูกค้า / เส้นทาง</h2>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-paper px-3 py-2">
                  <dt className="text-xs text-muted">ลูกค้าใหม่</dt>
                  <dd className="font-medium">{report.customers.newCustomers}</dd>
                </div>
                <div className="rounded-xl bg-paper px-3 py-2">
                  <dt className="text-xs text-muted">ลูกค้าซ้ำ</dt>
                  <dd className="font-medium">{report.customers.returningCustomers}</dd>
                </div>
              </dl>
              <ul className="mt-3 space-y-1 text-sm">
                {report.customers.topCustomers.slice(0, 5).map((row) => (
                  <li key={row.customerId} className="flex justify-between gap-2">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 text-muted">
                      {row.jobs} งาน · {formatMoney(row.serviceValue)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <p className="text-xs font-medium text-muted">เส้นทางยอดนิยม</p>
                <div className="mt-2">
                  <SimpleBars items={topRoutes} />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {canViewFinance && report.overview.cancelled > 0 ? (
        <section className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">ยกเลิก / ปฏิเสธ</h2>
          <p className="mt-1 text-sm">
            {report.overview.cancelled} งาน
            {report.booking.cancellationRate != null ? ` · ${report.booking.cancellationRate}%` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">ไม่แสดงเหตุผลจากโน้ตอิสระ — ใช้เฉพาะเหตุผลที่มีโครงสร้างเมื่อมี</p>
        </section>
      ) : null}

      <section>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-navy-800">คิววันนี้</h2>
            <p className="text-xs text-muted">สรุปสั้น ๆ · ตารางเต็มอยู่ที่หน้าเดินรถ</p>
          </div>
          <Link href="/store/calendar?view=today" className="text-sm font-medium text-accent-deep">
            เปิดตารางเดินรถ
          </Link>
        </div>
        <div className="mt-2">
          <DispatchBoard
            date={today}
            today={today}
            view="today"
            bookings={bookings}
            vehicles={vehicles}
            drivers={drivers}
            compact
          />
        </div>
      </section>
    </div>
  );
}
