"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportPreset, StoreReport } from "@/lib/domain/reporting";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";

const PRESETS: { key: ReportPreset; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "last7", label: "7 วัน" },
  { key: "thisMonth", label: "เดือนนี้" },
  { key: "lastMonth", label: "เดือนก่อน" },
  { key: "thisYear", label: "ปีนี้" },
  { key: "custom", label: "กำหนดเอง" },
];

export function ReportRangeBar({
  preset,
  start,
  end,
  label,
  basePath = "/store/reports",
}: {
  preset: ReportPreset;
  start: string;
  end: string;
  label: string;
  /** Where period changes navigate (dashboard vs reports). */
  basePath?: string;
}) {
  const router = useRouter();
  const [customStart, setCustomStart] = useState(start);
  const [customEnd, setCustomEnd] = useState(end);

  function go(next: ReportPreset, s = start, e = end) {
    const params = new URLSearchParams({ range: next });
    if (next === "custom") {
      params.set("start", s);
      params.set("end", e);
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted">ช่วงที่เลือก</p>
          <p className="font-medium text-navy-800">
            {label} · {formatThaiDate(start)}
            {start !== end ? ` – ${formatThaiDate(end)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => go(item.key, customStart, customEnd)}
            className={`rounded-full px-3 py-2 text-sm ${
              preset === item.key ? "bg-navy-800 text-white" : "bg-paper text-navy-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="date" className="admin-input" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          <input type="date" className="admin-input" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          <button type="button" className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950" onClick={() => go("custom", customStart, customEnd)}>
            ใช้ช่วงนี้
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}) {
  const className = `rounded-2xl bg-white p-4 text-left ${onClick ? "transition hover:border-accent/40 hover:shadow-sm border border-transparent" : ""}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 text-xl font-semibold text-navy-800">{value}</p>
        {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
      </button>
    );
  }
  return (
    <div className={className}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-navy-800">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function SimpleBars({
  items,
  valueKey = "count",
  labelKey = "label",
}: {
  items: Array<Record<string, string | number>>;
  valueKey?: string;
  labelKey?: string;
}) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] ?? 0)));
  if (!items.length) return <p className="text-sm text-muted">ยังไม่มีข้อมูลในช่วงเวลานี้</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const value = Number(item[valueKey] ?? 0);
        return (
          <li key={`${item[labelKey]}-${index}`}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="truncate text-navy-800">{String(item[labelKey])}</span>
              <span className="text-muted">{value.toLocaleString("th-TH")}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-navy-800" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DualBars({
  items,
  inLabel = "รับ",
  outLabel = "จ่าย",
}: {
  items: Array<{ date: string; in: number; out: number }>;
  inLabel?: string;
  outLabel?: string;
}) {
  const max = Math.max(1, ...items.flatMap((item) => [item.in, item.out]));
  if (!items.length) return <p className="text-sm text-muted">ยังไม่มีข้อมูลในช่วงเวลานี้</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.date}>
          <p className="mb-1 text-xs text-muted">{formatThaiDate(item.date)}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[10px] text-muted">{inLabel}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-navy-800" style={{ width: `${(item.in / max) * 100}%` }} />
              </div>
              <span className="w-16 text-right text-[10px]">{formatMoney(item.in)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[10px] text-muted">{outLabel}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(item.out / max) * 100}%` }} />
              </div>
              <span className="w-16 text-right text-[10px]">{formatMoney(item.out)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Funnel({
  steps,
}: {
  steps: Array<{ label: string; count: number; rate: number | null }>;
}) {
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={step.label} className="rounded-xl bg-paper px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-navy-800">
              {index + 1}. {step.label}
            </span>
            <span>
              {step.count}
              {step.rate != null ? <span className="ml-2 text-xs text-muted">{step.rate}%</span> : null}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(4, step.rate ?? (index === 0 ? 100 : 0))}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function OwnPartnerDonut({ ownJobs, partnerJobs }: { ownJobs: number; partnerJobs: number }) {
  const total = Math.max(1, ownJobs + partnerJobs);
  const ownPct = (ownJobs / total) * 100;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className="h-28 w-28 rounded-full"
        style={{
          background: `conic-gradient(#14213d 0 ${ownPct}%, #f4a261 ${ownPct}% 100%)`,
        }}
      />
      <ul className="space-y-1 text-sm">
        <li>
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-navy-800" />
          รถตัวเอง {ownJobs} งาน
        </li>
        <li>
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />
          รถทีม {partnerJobs} งาน
        </li>
      </ul>
    </div>
  );
}

export function DrillList({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: Array<{ id: string; label: string; sublabel?: string; amount?: number | null; href?: string }>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-navy-950/35" onClick={onClose} aria-label="ปิด" />
      <aside className="kh-drawer absolute inset-x-0 bottom-0 flex max-h-[80vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:max-w-md md:rounded-none">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold text-navy-800">{title}</h2>
            <p className="text-xs text-muted">{rows.length} รายการ</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            ปิด
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {rows.length === 0 ? <p className="text-sm text-muted">ยังไม่มีข้อมูลในช่วงเวลานี้</p> : null}
          {rows.map((row) =>
            row.href ? (
              <Link key={row.id} href={row.href} className="block rounded-xl bg-paper px-3 py-3 text-sm hover:bg-white">
                <p className="font-medium text-navy-800">{row.label}</p>
                {row.sublabel ? <p className="text-xs text-muted">{row.sublabel}</p> : null}
                {row.amount != null ? <p className="mt-1 text-xs">{formatMoney(row.amount)}</p> : null}
              </Link>
            ) : (
              <div key={row.id} className="rounded-xl bg-paper px-3 py-3 text-sm">
                <p className="font-medium text-navy-800">{row.label}</p>
                {row.sublabel ? <p className="text-xs text-muted">{row.sublabel}</p> : null}
              </div>
            ),
          )}
        </div>
      </aside>
    </div>
  );
}

export function ReportsView({ report }: { report: StoreReport }) {
  const [drill, setDrill] = useState<{ title: string; rows: StoreReport["booking"]["allRows"] } | null>(null);
  const bookingBars = useMemo(
    () => report.charts.bookingsByDay.map((item) => ({ label: formatThaiDate(item.date), count: item.count })),
    [report.charts.bookingsByDay],
  );

  return (
    <div className="space-y-6">
      {report.empty ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-muted">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="งานทั้งหมด" value={String(report.overview.bookings)} onClick={() => setDrill({ title: "งานทั้งหมด", rows: report.booking.allRows })} />
        <MetricCard label="งานสำเร็จ" value={String(report.overview.completed)} onClick={() => setDrill({ title: "งานสำเร็จ", rows: report.booking.completedRows })} />
        <MetricCard label="งานยกเลิก/ปฏิเสธ" value={String(report.overview.cancelled)} onClick={() => setDrill({ title: "งานยกเลิก", rows: report.booking.cancelledRows })} />
        <MetricCard
          label="อัตราสำเร็จ"
          value={report.overview.completionRate != null ? `${report.overview.completionRate}%` : "—"}
          hint={report.help.completion}
        />
        <MetricCard label="รายรับจริง" value={formatMoney(report.overview.totalCashIn)} />
        <MetricCard label="รายจ่ายจริง" value={formatMoney(report.overview.totalCashOut)} />
        <MetricCard
          label="ผลต่างรับ-จ่าย"
          value={formatMoney(report.overview.cashDifference)}
          hint={report.help.cashDifference}
        />
        <MetricCard label="รายรับค่าบริการ" value={formatMoney(report.overview.serviceRevenue)} hint="ไม่รวมทิป" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">งานจองตามเวลา</h2>
          <div className="mt-3">
            <SimpleBars items={bookingBars} />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">เงินรับ vs เงินจ่าย</h2>
          <div className="mt-3">
            <DualBars items={report.charts.cashByDay} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">Funnel งานจอง</h2>
          <div className="mt-3">
            <Funnel steps={report.booking.funnel} />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">OWN vs PARTNER</h2>
          <div className="mt-3">
            <OwnPartnerDonut ownJobs={report.own.jobs} partnerJobs={report.partner.jobs} />
          </div>
          <p className="mt-3 text-xs text-muted">{report.help.trips}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">รายรับ</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Mini label="มัดจำ" value={formatMoney(report.income.deposit)} />
            <Mini label="ยอดค่าบริการ/คงเหลือ" value={formatMoney(report.income.serviceBalance)} />
            <Mini label="รายรับค่าบริการ" value={formatMoney(report.income.serviceRevenue)} />
            <Mini label="ทิปที่รับ" value={formatMoney(report.income.tipReceived)} />
            <Mini label="เงินรับทั้งหมด" value={formatMoney(report.income.totalCashIn)} />
          </dl>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">รายจ่าย</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Mini label="จ่ายค่าตัว" value={formatMoney(report.expense.driverPayout)} />
            <Mini label="จ่าย Partner" value={formatMoney(report.expense.partnerPayout)} />
            <Mini label="ส่งต่อทิป" value={formatMoney(report.expense.tipPayout)} />
            <Mini label="จ่ายรวม" value={formatMoney(report.expense.totalCashOut)} />
          </dl>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-semibold text-navy-800">ค้างชำระ / ค้างจ่าย</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="ลูกค้าค้างชำระ"
            value={formatMoney(report.outstanding.receivableAmount)}
            hint={`${report.outstanding.receivableCount} งาน`}
            onClick={() => setDrill({ title: "ลูกค้าค้างชำระ", rows: report.outstanding.receivableRows })}
          />
          <MetricCard
            label="ค่าตัวค้างจ่าย"
            value={formatMoney(report.outstanding.driverAmount)}
            hint={`${report.outstanding.driverCount} งาน`}
            onClick={() => setDrill({ title: "ค่าตัวค้างจ่าย", rows: report.outstanding.payoutRows })}
          />
          <MetricCard label="Partner ค้างจ่าย" value={formatMoney(report.outstanding.partnerAmount)} hint={`${report.outstanding.partnerCount} งาน`} />
          <MetricCard label="ทิปรอส่งต่อ" value={formatMoney(report.outstanding.tipAmount)} hint={`${report.outstanding.tipCount} งาน`} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FleetBlock
          title="รถตัวเอง (OWN)"
          used={report.own.vehiclesUsed}
          jobs={report.own.jobs}
          days={report.own.serviceDays}
          rows={report.own.perVehicle.map((item) => ({
            id: item.vehicle.id,
            title: `${item.vehicle.brand} ${item.vehicle.model}`,
            plate: item.vehicle.plateNumber,
            jobs: item.jobs,
            trips: item.trips,
            days: item.serviceDays,
            completed: item.completed,
          }))}
          onOpen={() => setDrill({ title: "งานรถตัวเอง", rows: report.own.jobRows })}
        />
        <FleetBlock
          title="รถทีม / Partner"
          used={report.partner.vehiclesUsed}
          jobs={report.partner.jobs}
          days={report.partner.serviceDays}
          extra={`จ่าย Partner ${formatMoney(report.partner.partnerPaid)} · ค้าง ${formatMoney(report.partner.partnerDue)}`}
          rows={report.partner.perVehicle.map((item) => ({
            id: item.vehicle.id,
            title: `${item.vehicle.brand} ${item.vehicle.model}`,
            plate: item.vehicle.plateNumber,
            jobs: item.jobs,
            trips: item.trips,
            days: item.serviceDays,
            completed: item.completed,
          }))}
          onOpen={() => setDrill({ title: "งานรถทีม", rows: report.partner.jobRows })}
        />
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-semibold text-navy-800">คนขับ</h2>
        {report.drivers.length === 0 ? (
          <p className="mt-3 text-sm text-muted">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {report.drivers.map((row) => (
              <li key={row.driver.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-navy-800">{row.driver.name}</p>
                  <p className="text-xs text-muted">
                    {row.jobs} งาน · สำเร็จ {row.completed} · ใช้งาน {row.serviceDays} วัน
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>ค่าตัว {formatMoney(row.driverPayout)}</p>
                  <p>ทิป {formatMoney(row.tipPayout)}</p>
                  <p>ค้าง {formatMoney(row.pendingPayout)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">ลูกค้า</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Mini label="ลูกค้าในช่วง" value={report.customers.periodCustomers} />
            <Mini label="ลูกค้าใหม่" value={report.customers.newCustomers} />
            <Mini label="ลูกค้าเดิม" value={report.customers.returningCustomers} />
            <Mini label="จองซ้ำในช่วง" value={report.customers.repeatInPeriod} />
          </dl>
          <p className="mt-2 text-xs text-muted">{report.help.repeat}</p>
          <ul className="mt-3 space-y-2">
            {report.customers.topCustomers.map((row) => (
              <li key={row.customerId} className="rounded-xl bg-paper px-3 py-2 text-sm">
                <p className="font-medium text-navy-800">
                  {row.name}
                  {row.isRepeat ? <span className="ml-2 text-[10px] text-accent-deep">ซ้ำ</span> : null}
                </p>
                <p className="text-xs text-muted">
                  {row.jobs} งาน · สำเร็จ {row.completed} · {formatMoney(row.serviceValue)}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">เส้นทางยอดนิยม</h2>
          {report.routes.length === 0 ? (
            <p className="mt-3 text-sm text-muted">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {report.routes.map((row) => (
                <li key={row.route} className="rounded-xl bg-paper px-3 py-2 text-sm">
                  <p className="font-medium text-navy-800">{row.route}</p>
                  <p className="text-xs text-muted">
                    {row.count} งาน · สำเร็จ {row.completed}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">ใบเสนอราคา</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Mini label="ส่งแล้ว" value={report.quotation.sent} />
            <Mini label="ยืนยัน" value={report.quotation.accepted} />
            <Mini label="ขอแก้ไข" value={report.quotation.changeRequested} />
            <Mini label="ปฏิเสธ" value={report.quotation.rejected} />
            <Mini label="หมดอายุ" value={report.quotation.expired} />
            <Mini label="อัตรายืนยัน" value={report.quotation.acceptanceRate != null ? `${report.quotation.acceptanceRate}%` : "—"} />
            <Mini label="มูลค่าเฉลี่ยที่ยืนยัน" value={formatMoney(report.quotation.avgAcceptedValue)} />
          </dl>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <h2 className="font-semibold text-navy-800">สลิป / หลักฐานโอน</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Mini label="ส่งทั้งหมด" value={report.proofs.submitted} />
            <Mini label="อนุมัติ" value={report.proofs.approved} />
            <Mini label="ปฏิเสธ" value={report.proofs.rejected} />
            <Mini label="รอตรวจ" value={report.proofs.pending} />
          </dl>
          <p className="mt-3 text-xs text-muted">สลิปรอตรวจ/ปฏิเสธไม่นับเป็นรายรับ</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-semibold text-navy-800">งานยกเลิก</h2>
        <p className="mt-2 text-sm text-navy-800">
          {report.booking.cancelled + report.booking.rejected} งาน · อัตรา{" "}
          {report.booking.cancellationRate != null ? `${report.booking.cancellationRate}%` : "—"}
        </p>
        <p className="mt-1 text-xs text-muted">เหตุผล: ไม่ระบุเหตุผล (ยังไม่มีฟิลด์เหตุผลในระบบ)</p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-accent-deep"
          onClick={() => setDrill({ title: "งานยกเลิก", rows: report.booking.cancelledRows })}
        >
          ดูรายการ
        </button>
      </section>

      {drill ? <DrillList title={drill.title} rows={drill.rows} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}

function FleetBlock({
  title,
  used,
  jobs,
  days,
  rows,
  extra,
  onOpen,
}: {
  title: string;
  used: number;
  jobs: number;
  days: number;
  rows: Array<{ id: string; title: string; plate: string | null; jobs: number; trips: number; days: number; completed: number }>;
  extra?: string;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold text-navy-800">{title}</h2>
        <button type="button" onClick={onOpen} className="text-xs font-medium text-accent-deep">
          ดูงาน
        </button>
      </div>
      <p className="mt-2 text-sm text-navy-800">
        {used} คัน · {jobs} งาน/{jobs} รอบ · ใช้งาน {days} วัน
      </p>
      {extra ? <p className="mt-1 text-xs text-muted">{extra}</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.length === 0 ? <li className="text-sm text-muted">ยังไม่มีข้อมูลในช่วงเวลานี้</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
            <p className="font-medium text-navy-800">{row.title}</p>
            <p className="text-xs text-muted">{row.plate ?? "—"}</p>
            <p className="mt-1 text-xs">
              {row.jobs} งาน · {row.trips} รอบ · ใช้งาน {row.days} วัน · สำเร็จ {row.completed}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium text-navy-800">{value}</dd>
    </div>
  );
}
