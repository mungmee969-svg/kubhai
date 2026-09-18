"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookingItineraryDays } from "@/components/booking/ItineraryDaysView";
import { Feedback } from "@/components/store-admin/ui/Feedback";
import { AssignDrawer } from "@/components/store-admin/booking/AssignDrawer";
import { markBookingOpened } from "@/components/store-admin/booking/BookingInboxCard";
import { FinanceBadge } from "@/components/store-admin/booking/FinanceBadge";
import { JobCloseoutPanel } from "@/components/store-admin/booking/JobCloseoutPanel";
import { TripProgressPanel } from "@/components/store-admin/booking/TripProgressPanel";
import { PayoutDrawer, ReceiveMoneyDrawer } from "@/components/store-admin/booking/MoneyDrawers";
import { ProofHistory, ReceivingAccountCard, SlipReviewDrawer } from "@/components/store-admin/booking/PaymentReview";
import { StoreOfferForm } from "@/components/store-admin/booking/StoreOfferForm";
import { CancelBookingSheet } from "@/components/store-admin/booking/CancelBookingSheet";
import { QuotationDocument } from "@/components/quotation/QuotationDocument";
import { PaymentInstructions } from "@/components/payment/PaymentInstructions";
import {
  createQuotationDraftAction,
  createQuotationRevisionAction,
} from "@/lib/actions/quotation";
import { assignBookingAction, updateBookingStatusAction } from "@/lib/actions/store";
import {
  addNoteAction,
  deleteItineraryAction,
  saveItineraryAction,
} from "@/lib/actions/ops";
import { buildBookingCloseout } from "@/lib/domain/closeout";
import {
  OPS_PROGRESS_LABELS,
  ownerFacingStatus,
  resolveBookingNextAction,
} from "@/lib/domain/booking-ops-next";
import { canTransition } from "@/lib/domain/booking-rules";
import { SERVICE_TYPE_LABELS, type BookingStatus } from "@/lib/domain/enums";
import { formatDuration } from "@/lib/domain/fleet";
import { formatMoney, formatThaiDate } from "@/lib/domain/ops";
import { buildPaymentInstruction } from "@/lib/domain/payment-instructions";
import { currentAdminQuotation, quotationAttention } from "@/lib/domain/quotation";
import { settleBooking } from "@/lib/domain/settlement";
import { PRIMARY_ACTION } from "@/lib/domain/status-ui";
import type { BookingRecord, DriverJobAdminSummary, QuotationRecord } from "@/lib/data/repository";
import type { Booking, Driver, PaymentAccount, PaymentProof, Place, Vehicle } from "@/lib/domain/types";
import {
  DRIVER_DAY_STATUS_LABEL,
  buildDayShell,
  driverJobPath,
  resolveDayWorkStatus,
} from "@/lib/domain/driver-job";

const SECONDARY: BookingStatus[] = ["CANCELLED", "REJECTED"];

export function BookingWorkspace({
  record,
  tripPackageTitle,
  vehicles,
  drivers,
  places,
  bookings,
  accounts,
  initialProofId,
  driverJob,
}: {
  record: BookingRecord;
  tripPackageTitle?: string | null;
  vehicles: Vehicle[];
  drivers: Driver[];
  places: Place[];
  bookings: Booking[];
  accounts: PaymentAccount[];
  initialProofId?: string;
  driverJob?: DriverJobAdminSummary | null;
}) {
  const router = useRouter();
  const booking = record.booking;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"dispatch" | "receive" | "payout" | null>(null);
  const [closeoutOpen, setCloseoutOpen] = useState(false);
  const [offer, setOffer] = useState<QuotationRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(true);
  const [stopTitle, setStopTitle] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [itineraryDay, setItineraryDay] = useState(1);
  const [note, setNote] = useState("");
  const [customerTip, setCustomerTip] = useState("");
  const [reviewProof, setReviewProof] = useState<PaymentProof | null>(
    () => record.proofs.find((item) => item.id === initialProofId) ?? null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    markBookingOpened(booking.id);
  }, [booking.id]);

  const settlement = settleBooking(booking, record.movements);
  const closeout = buildBookingCloseout(booking, record.movements, { vehicle: record.vehicle });
  const pendingProof = record.proofs.some((item) => item.reviewStatus === "PENDING_REVIEW");
  const quoteAttention = quotationAttention(record.quotations, booking);
  const next = resolveBookingNextAction(booking, record.quotations, settlement, {
    pendingProof,
    quotationAttention: quoteAttention,
  });
  const currentQuote = currentAdminQuotation(record.quotations);
  const vehicle = vehicles.find((item) => item.id === booking.assignedVehicleId);
  const driver = drivers.find((item) => item.id === booking.assignedDriverId);
  const assigned = Boolean(vehicle && driver);
  const primary = PRIMARY_ACTION[booking.status];
  const activeDriverLink = driverJob?.link ?? null;
  const driverDayShell = useMemo(() => buildDayShell(booking), [booking]);
  const driverHasActiveDay = useMemo(() => {
    if (!driverJob?.dayLogs?.length) return false;
    return driverJob.dayLogs.some((log) => resolveDayWorkStatus(log) === "ACTIVE");
  }, [driverJob]);

  const showMoney =
    ["CUSTOMER_CONFIRMED", "WAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(
      booking.status,
    ) || pendingProof;
  const showTripOps = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status);
  const waitingCustomer = next.kind === "WAIT_CUSTOMER";
  const phoneHref = booking.customerPhoneSnapshot
    ? `tel:${booking.customerPhoneSnapshot.replace(/\s+/g, "")}`
    : null;

  const itineraryDayOptions = useMemo(() => {
    const fromItems = Math.max(1, ...record.itinerary.map((item) => item.dayNumber ?? 1));
    let span = 1;
    if (booking.startDate && booking.endDate && booking.endDate !== booking.startDate) {
      const start = Date.parse(`${booking.startDate}T00:00:00`);
      const end = Date.parse(`${booking.endDate}T00:00:00`);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        span = Math.floor((end - start) / 86_400_000) + 1;
      }
    }
    const total = Math.max(1, fromItems, span);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [booking.startDate, booking.endDate, record.itinerary]);

  async function run(
    fn: () => Promise<{ ok: true; data?: { id?: string } } | { ok: false; error: string }>,
    okMessage?: string,
  ) {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(okMessage ?? "บันทึกแล้ว");
    router.refresh();
  }

  async function openOffer() {
    if (pending) return;
    setPending(true);
    setError(null);
    if (currentQuote?.status === "DRAFT") {
      setOffer(currentQuote);
      setPending(false);
      return;
    }
    if (currentQuote) {
      const result = await createQuotationRevisionAction(currentQuote.id, booking.id);
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data?.quote) setOffer(result.data.quote);
      router.refresh();
      return;
    }
    const result = await createQuotationDraftAction(booking.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data?.quote) setOffer(result.data.quote);
    router.refresh();
  }

  const stickyCta = useMemo(() => {
    if (!next.ctaLabel) return null;
    if (next.kind === "ASSIGN" || next.kind === "REVIEW_AND_ASSIGN") {
      return { label: next.ctaLabel, action: () => setDrawer("dispatch") };
    }
    if (next.kind === "CREATE_OFFER" || next.kind === "SEND_OFFER") {
      return {
        label: next.ctaLabel,
        action: () => {
          if (currentQuote?.status === "DRAFT") setOffer(currentQuote);
          else void openOffer();
        },
      };
    }
    if (next.kind === "REVIEW_PROOF") {
      const proof = record.proofs.find((item) => item.reviewStatus === "PENDING_REVIEW");
      return {
        label: next.ctaLabel,
        action: () => (proof ? setReviewProof(proof) : undefined),
      };
    }
    if (next.kind === "START_JOB" && driverHasActiveDay) {
      return null;
    }
    if (next.kind === "START_JOB" && primary && canTransition(booking.status, primary.to)) {
      return {
        label: next.ctaLabel,
        action: () => run(() => updateBookingStatusAction(booking.id, primary.to), primary.label),
      };
    }
    if (next.kind === "COMPLETE_JOB" || next.kind === "SETTLE") {
      return { label: next.ctaLabel, action: () => setCloseoutOpen(true) };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, currentQuote, booking.status, primary, record.proofs, driverHasActiveDay]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-28 xl:max-w-6xl">
      <header className="rounded-2xl bg-white p-4 sm:p-5">
        <Link href="/store/bookings" className="text-sm text-muted hover:text-navy-800">
          ← งานจอง
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted">{booking.bookingCode}</p>
            {tripPackageTitle ? (
              <p className="mt-1 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)]">
                แพ็กเกจ: {tripPackageTitle}
              </p>
            ) : null}
            <h1 className="mt-1 text-xl font-semibold text-[color:var(--store-primary,#0F3D3E)] sm:text-2xl">
              {booking.customerNameSnapshot}
            </h1>
            <p className="mt-1 text-sm text-navy-800">
              {formatThaiDate(booking.startDate)}
              {booking.endDate && booking.endDate !== booking.startDate
                ? ` – ${formatThaiDate(booking.endDate)}`
                : ""}{" "}
              · {formatDuration(booking)}
            </p>
          </div>
          <span className="rounded-full bg-[color:var(--store-accent,#C4A35A)]/20 px-3 py-1.5 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)]">
            {driverHasActiveDay ? "คนขับกำลังปฏิบัติงาน" : ownerFacingStatus(booking)}
          </span>
        </div>

        {next.progressStep <= 4 &&
        ["REQUESTED", "CHECKING_AVAILABILITY", "AVAILABLE", "QUOTATION_SENT"].includes(booking.status) ? (
          <ol className="mt-4 flex items-center gap-1 text-[11px] sm:text-xs">
            {OPS_PROGRESS_LABELS.map((label, index) => {
              const step = (index + 1) as 1 | 2 | 3 | 4;
              const active = step === next.progressStep;
              const done = step < next.progressStep;
              return (
                <li key={label} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      active
                        ? "bg-[color:var(--store-accent,#C4A35A)] text-navy-950"
                        : done
                          ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
                          : "bg-paper text-muted"
                    }`}
                  >
                    {done ? "✓" : step}
                  </span>
                  <span className={active ? "font-semibold text-navy-800" : "text-muted"}>{label}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {waitingCustomer ? (
          <p className="mt-4 rounded-xl bg-paper px-3 py-2.5 text-sm text-navy-800">
            ส่งใบเสนอราคาแล้ว — รอลูกค้ายืนยัน
          </p>
        ) : null}
        {booking.status === "CUSTOMER_CONFIRMED" || next.kind === "WAIT_DEPOSIT" ? (
          <p className="mt-4 rounded-xl bg-[color:var(--store-accent,#C4A35A)]/20 px-3 py-2.5 text-sm font-medium text-[color:var(--store-primary,#0F3D3E)]">
            ลูกค้ายืนยันใบเสนอราคาแล้ว — ขั้นตอนถัดไปคือมัดจำ/ตรวจสอบการชำระเงิน
          </p>
        ) : null}
      </header>

      <Feedback error={error} success={success} />

      {/* 1. Current action */}
      <section className="rounded-2xl border border-[color:var(--store-accent,#C4A35A)]/40 bg-white p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">สิ่งที่ต้องทำตอนนี้</p>
        <h2 className="mt-1 text-lg font-semibold text-[color:var(--store-primary,#0F3D3E)]">{next.title}</h2>
        <p className="mt-1 text-sm text-muted">{next.description}</p>
        {next.checklist.some((item) => !item.done) ? (
          <ul className="mt-3 space-y-1.5 text-sm">
            {next.checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <span className={item.done ? "text-success" : "text-muted"}>{item.done ? "✓" : "○"}</span>
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
        {waitingCustomer && currentQuote ? (
          <div className="mt-4 rounded-xl bg-paper px-3 py-3 text-sm">
            <p className="font-medium text-navy-800">✓ ส่งข้อเสนอแล้ว</p>
            <p className="text-muted">
              ส่งเมื่อ {currentQuote.sentAt ? currentQuote.sentAt.slice(0, 16).replace("T", " ") : "—"}
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-[color:var(--store-primary,#0F3D3E)]"
              onClick={() => setDetailsOpen(true)}
            >
              ดูข้อเสนอที่ส่ง
            </button>
            <button
              type="button"
              disabled={pending}
              className="mt-2 block text-sm text-muted"
              onClick={() => void openOffer()}
            >
              แก้ไขและส่งฉบับใหม่
            </button>
          </div>
        ) : null}
        {stickyCta && next.kind !== "WAIT_CUSTOMER" ? (
          <button
            type="button"
            disabled={pending}
            onClick={stickyCta.action}
            className="mt-4 hidden h-12 w-full rounded-xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-navy-950 disabled:opacity-60 xl:block"
          >
            {pending ? "กำลังบันทึก..." : stickyCta.label}
          </button>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          {/* 2. Customer + booking summary */}
          <section className="rounded-2xl bg-white p-4 sm:p-5">
            <h2 className="font-semibold text-navy-800">รายละเอียดการจอง</h2>
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-lg font-semibold text-navy-800">{booking.customerNameSnapshot}</p>
              <p className="text-muted">{booking.customerPhoneSnapshot}</p>
              {booking.customerEmailSnapshot ? (
                <p className="text-muted">{booking.customerEmailSnapshot}</p>
              ) : null}
              <p className="pt-2">
                {booking.passengerCount} ผู้โดยสาร
                {booking.luggageCount != null ? ` · ${booking.luggageCount} กระเป๋า` : ""}
              </p>
              <p>บริการ: {SERVICE_TYPE_LABELS[booking.serviceType]}</p>
              <p>
                เดินทาง: {formatThaiDate(booking.startDate)} {booking.startTime ?? ""}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {phoneHref ? (
                <a href={phoneHref} className="inline-flex h-11 items-center rounded-xl bg-paper px-4 text-sm">
                  โทร
                </a>
              ) : null}
              {booking.customerPhoneSnapshot ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center rounded-xl bg-paper px-4 text-sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(booking.customerPhoneSnapshot);
                      setSuccess("คัดลอกเบอร์แล้ว");
                    } catch {
                      setError("คัดลอกเบอร์ไม่ได้");
                    }
                  }}
                >
                  คัดลอกเบอร์
                </button>
              ) : null}
              {record.customer ? (
                <Link
                  href={`/store/customers/${record.customer.id}`}
                  className="inline-flex h-11 items-center rounded-xl bg-paper px-4 text-sm"
                >
                  โปรไฟล์ลูกค้า
                </Link>
              ) : null}
            </div>
          </section>

          {/* 3. Itinerary */}
          <section className="rounded-2xl bg-white p-4 sm:p-5">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setTripOpen((value) => !value)}
            >
              <h2 className="font-semibold text-navy-800">แผนการเดินทาง</h2>
              <span className="text-sm text-muted">{tripOpen ? "ซ่อน" : "แสดง"}</span>
            </button>
            {tripOpen ? (
              <div className="mt-3">
                <BookingItineraryDays
                  itinerary={record.itinerary}
                  startDate={booking.startDate}
                  endDate={booking.endDate}
                  letStorePlanTrip={booking.letStorePlanTrip}
                />
                <div className="mt-4 rounded-xl bg-paper p-4 text-sm">
                  <p className="font-medium text-navy-800">เส้นทางที่ลูกค้าส่งมา</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted">จุดรับ</p>
                      <p className="mt-1 font-medium text-navy-800">{booking.pickupLocation || "—"}</p>
                      {booking.pickupLat != null && booking.pickupLng != null ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${booking.pickupLat},${booking.pickupLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)] underline underline-offset-2"
                        >
                          ดูจุดรับบนแผนที่ ↗
                        </a>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-muted">จุดส่ง</p>
                      <p className="mt-1 font-medium text-navy-800">{booking.dropoffLocation || "—"}</p>
                      {booking.dropoffLat != null && booking.dropoffLng != null ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${booking.dropoffLat},${booking.dropoffLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)] underline underline-offset-2"
                        >
                          ดูจุดส่งบนแผนที่ ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    ใช้ข้อมูลต้นฉบับจากคำขอจองเป็นหลัก ร้านไม่ต้องสร้างเส้นทางใหม่
                  </p>
                </div>
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <p className="text-sm font-medium text-navy-800">ปรับแผน / เพิ่มคำแนะนำ</p>
                  <select className="admin-input" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
                    <option value="">เลือกจากสถานที่ร้าน</option>
                    {places.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name} · {place.category}
                      </option>
                    ))}
                  </select>
                  <input
                    className="admin-input"
                    placeholder="หรือพิมพ์ชื่อจุด / คำแนะนำ"
                    value={stopTitle}
                    onChange={(e) => setStopTitle(e.target.value)}
                  />
                  {itineraryDayOptions.length > 1 ? (
                    <label className="block space-y-1">
                      <span className="text-xs text-muted">เพิ่มในวัน</span>
                      <select
                        className="admin-input"
                        value={itineraryDay}
                        onChange={(e) => setItineraryDay(Number(e.target.value))}
                      >
                        {itineraryDayOptions.map((day) => (
                          <option key={day} value={day}>
                            วันที่ {day}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const place = places.find((item) => item.id === placeId);
                      return run(() =>
                        saveItineraryAction(booking.id, {
                          title: stopTitle || place?.name || "",
                          location: place?.address ?? null,
                          dayNumber: itineraryDayOptions.length > 1 ? itineraryDay : 1,
                          estimatedMinutes: place?.estimatedDurationMinutes ?? null,
                          note: place ? `คำแนะนำร้าน · ${place.category}` : null,
                          placeId: place?.id ?? null,
                        }),
                      );
                    }}
                    className="h-11 w-full rounded-xl bg-[color:var(--store-primary,#0F3D3E)] text-sm text-white disabled:opacity-60"
                  >
                    + เพิ่มคำแนะนำ / จุดแวะ
                  </button>
                  {record.itinerary.length ? (
                    <ul className="space-y-2 text-sm">
                      {record.itinerary.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                          <span className="min-w-0 truncate">
                            {item.dayNumber && item.dayNumber > 0 ? `วัน ${item.dayNumber} · ` : ""}
                            {item.title}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-danger"
                            onClick={() => run(() => deleteItineraryAction(item.id, booking.id))}
                          >
                            ลบ
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl bg-white p-4 sm:p-5">
            <h2 className="font-semibold text-navy-800">คำแนะนำถึงลูกค้า</h2>
            <p className="mt-1 text-xs text-muted">ลูกค้าเห็นในรายละเอียดการจอง / บริบทใบเสนอราคา — ไม่เปลี่ยนแผนทริปอัตโนมัติ</p>
            <ul className="mt-3 space-y-2 text-sm">
              {record.notes
                .filter((item) => item.audience === "CUSTOMER")
                .map((item) => (
                  <li key={item.id} className="rounded-xl bg-[color:var(--store-accent,#C4A35A)]/10 px-3 py-2">
                    {item.title ? <p className="text-xs font-semibold">{item.title}</p> : null}
                    {item.body}
                    <span className="mt-1 block text-xs text-muted">{item.createdAt.slice(0, 16)}</span>
                  </li>
                ))}
            </ul>
            <textarea
              className="admin-input mt-3 min-h-20 py-3"
              placeholder="เช่น แนะนำเปลี่ยนวันแรกเป็นดอยสุเทพก่อน เพราะช่วงบ่ายรถติด"
              value={customerTip}
              onChange={(e) => setCustomerTip(e.target.value)}
            />
            <button
              type="button"
              disabled={pending || !customerTip.trim()}
              onClick={() =>
                run(async () => {
                  const result = await addNoteAction(booking.id, customerTip, {
                    audience: "CUSTOMER",
                    title: "คำแนะนำจากร้าน",
                  });
                  if (result.ok) setCustomerTip("");
                  return result;
                }, "เพิ่มคำแนะนำให้ลูกค้าแล้ว")
              }
              className="mt-2 h-11 w-full rounded-xl bg-[color:var(--store-primary,#0F3D3E)] text-sm text-white disabled:opacity-60"
            >
              + เพิ่มคำแนะนำให้ลูกค้า
            </button>
          </section>

          {/* 4. Vehicle + driver */}
          <section className="rounded-2xl bg-white p-4 sm:p-5">
            <h2 className="font-semibold text-navy-800">รถและคนขับ</h2>
            {assigned ? (
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  รถ: {vehicle!.brand} {vehicle!.model}
                  {vehicle!.plateNumber ? ` · ${vehicle!.plateNumber}` : ""}
                </p>
                <p>คนขับ: {driver!.name}</p>
                <p className="text-xs text-muted">
                  รถที่ลูกค้าขอ:{" "}
                  {record.preferredVehicle
                    ? `${record.preferredVehicle.brand} ${record.preferredVehicle.model}`
                    : "ให้ร้านแนะนำ"}
                </p>
                {driverHasActiveDay ? (
                  <p className="mt-2 rounded-xl bg-[color:var(--store-primary,#0F3D3E)]/10 px-3 py-2 text-sm font-medium text-[color:var(--store-primary,#0F3D3E)]">
                    คนขับกำลังปฏิบัติงาน
                  </p>
                ) : null}
                {activeDriverLink ? (
                  <DriverJobLinkPanel
                    token={activeDriverLink.secureToken}
                    firstOpenedAt={activeDriverLink.firstOpenedAt}
                    days={driverDayShell.map((day) => {
                      const log =
                        driverJob?.dayLogs.find((item) => item.dayNumber === day.dayNumber) ?? null;
                      return {
                        dayNumber: day.dayNumber,
                        status: resolveDayWorkStatus(log),
                      };
                    })}
                  />
                ) : (
                  <p className="mt-2 text-xs text-muted">ยังไม่มีลิงก์งานคนขับ — จัดคนขับอีกครั้งเพื่อออกลิงก์</p>
                )}
                <button
                  type="button"
                  onClick={() => setDrawer("dispatch")}
                  className="mt-3 h-11 rounded-xl bg-paper px-4 text-sm"
                >
                  เปลี่ยนรถและคนขับ
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="rounded-xl bg-[color:var(--store-accent,#C4A35A)]/15 px-3 py-2 text-sm font-medium">
                  ⚠ ยังไม่ได้จัดรถและคนขับ
                </p>
                <button
                  type="button"
                  onClick={() => setDrawer("dispatch")}
                  className="mt-3 h-11 w-full rounded-xl bg-[color:var(--store-primary,#0F3D3E)] text-sm text-white"
                >
                  จัดรถและคนขับ
                </button>
              </div>
            )}
          </section>

          {/* 5. Quotation */}
          {!waitingCustomer ? (
            <section className="rounded-2xl bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-navy-800">ข้อเสนอราคา</h2>
              {currentQuote ? (
                <div className="mt-3 text-sm">
                  <p>
                    {currentQuote.quotationNumber} · ฉบับที่ {currentQuote.version}
                  </p>
                  <p className="mt-1 font-semibold">{formatMoney(currentQuote.totalAmount)}</p>
                  {currentQuote.includedHoursPerDay != null || currentQuote.overtimeRatePerHour != null ? (
                    <p className="mt-1 text-xs text-muted">
                      {currentQuote.includedHoursPerDay != null
                        ? `รวม ${currentQuote.includedHoursPerDay} ชม./วัน`
                        : ""}
                      {currentQuote.includedHoursPerDay != null && currentQuote.overtimeRatePerHour != null
                        ? " · "
                        : ""}
                      {currentQuote.overtimeRatePerHour != null
                        ? `OT ${formatMoney(currentQuote.overtimeRatePerHour)}/ชม.`
                        : ""}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-3 h-11 rounded-xl bg-[color:var(--store-primary,#0F3D3E)] px-4 text-sm text-white"
                    onClick={() => {
                      if (currentQuote.status === "DRAFT") setOffer(currentQuote);
                      else void openOffer();
                    }}
                  >
                    {currentQuote.status === "DRAFT" ? "แก้ข้อเสนอ" : "แก้ไขและส่งฉบับใหม่"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void openOffer()}
                  className="mt-3 h-11 w-full rounded-xl bg-[color:var(--store-primary,#0F3D3E)] text-sm text-white disabled:opacity-60"
                >
                  สร้างข้อเสนอ
                </button>
              )}
            </section>
          ) : currentQuote ? (
            <section className="rounded-2xl bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-navy-800">ข้อเสนอที่ส่งแล้ว</h2>
              <div className="mt-3">
                <QuotationDocument
                  quotation={currentQuote}
                  booking={record.booking}
                  business={record.business}
                  customer={record.customer}
                  itinerary={record.itinerary}
                />
              </div>
            </section>
          ) : null}

          {showTripOps ? (
            <TripProgressPanel
              record={record}
              canCloseout={Boolean(primary && primary.to === "COMPLETED" && canTransition(booking.status, primary.to))}
              onOpenCloseout={() => setCloseoutOpen(true)}
            />
          ) : null}

          {showMoney ? (
            <section className="rounded-2xl bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-navy-800">มัดจำ / การเงิน</h2>
              {closeout.outstandingBadge ? (
                <p className="mt-2 text-sm font-semibold text-accent-deep">{closeout.outstandingBadge}</p>
              ) : (
                <div className="mt-2">
                  <FinanceBadge state={settlement.state} />
                </div>
              )}
              <p className="mt-2 text-sm">มัดจำที่กำหนด {formatMoney(settlement.expectedDeposit)}</p>
              <p className="text-sm">ลูกค้าค้าง {formatMoney(settlement.remainingBalance)}</p>
              <div className="mt-4">
                <ReceivingAccountCard
                  bookingId={booking.id}
                  account={record.receivingAccount}
                  accounts={accounts}
                />
              </div>
              <div className="mt-4 rounded-2xl bg-paper p-4">
                <PaymentInstructions
                  compact
                  instruction={buildPaymentInstruction({
                    bookingCode: booking.bookingCode,
                    account: record.receivingAccount,
                    settlement,
                  })}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setDrawer("receive")} className="h-11 rounded-xl bg-paper px-4 text-sm">
                  บันทึกรับเงิน
                </button>
                <button type="button" onClick={() => setDrawer("payout")} className="h-11 rounded-xl bg-paper px-4 text-sm">
                  บันทึกการโอน
                </button>
              </div>
              <h3 className="mt-5 font-medium text-navy-800">สลิป / หลักฐานโอน</h3>
              <ProofHistory proofs={record.proofs} onReview={setReviewProof} />
            </section>
          ) : null}

          {/* Collapsed extras */}
          <details className="rounded-2xl bg-white p-4 sm:p-5">
            <summary className="cursor-pointer font-semibold text-navy-800">รายละเอียดเพิ่มเติม</summary>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-navy-800">โน้ตภายใน</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {record.notes
                    .filter((item) => item.audience !== "CUSTOMER")
                    .map((item) => (
                    <li key={item.id} className="rounded-xl bg-paper px-3 py-2">
                      {item.body}
                      <span className="mt-1 block text-xs text-muted">{item.createdAt.slice(0, 16)}</span>
                    </li>
                  ))}
                </ul>
                <textarea className="admin-input mt-3 min-h-20 py-3" value={note} onChange={(e) => setNote(e.target.value)} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await addNoteAction(booking.id, note, { audience: "INTERNAL" });
                      if (result.ok) setNote("");
                      return result;
                    })
                  }
                  className="mt-2 h-11 w-full rounded-xl bg-navy-800 text-sm text-white disabled:opacity-60"
                >
                  เพิ่มโน้ต
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {SECONDARY.filter((status) => canTransition(booking.status, status) && status !== booking.status).map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (status === "CANCELLED") {
                          setCancelOpen(true);
                          return;
                        }
                        run(() => updateBookingStatusAction(booking.id, status));
                      }}
                      className="ui-press rounded-full bg-paper px-3 py-2 text-xs text-danger disabled:opacity-60"
                    >
                      {status === "CANCELLED" ? "ยกเลิกงาน" : "ปฏิเสธคำขอ"}
                    </button>
                  ),
                )}
              </div>
            </div>
          </details>
        </div>

        <aside className="hidden space-y-4 xl:sticky xl:top-24 xl:block xl:self-start">
          <section className="rounded-2xl bg-white p-5 text-sm">
            <h2 className="font-semibold text-navy-800">สรุปด่วน</h2>
            <p className="mt-2">{ownerFacingStatus(booking)}</p>
            <p className="mt-2 text-muted">{next.title}</p>
            {quoteAttention ? <p className="mt-2 text-accent-deep">{quoteAttention}</p> : null}
          </section>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      {stickyCta ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur xl:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={pending}
            onClick={stickyCta.action}
            className="h-12 w-full rounded-xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-navy-950 disabled:opacity-60"
          >
            {pending ? "กำลังบันทึก..." : stickyCta.label}
          </button>
        </div>
      ) : null}

      <AssignDrawer
        open={drawer === "dispatch"}
        kind="dispatch"
        booking={booking}
        bookings={bookings}
        vehicles={vehicles}
        drivers={drivers}
        pending={pending}
        onClose={() => setDrawer(null)}
        onDispatch={(vehicleId, driverId) =>
          run(async () => {
            const result = await assignBookingAction(booking.id, { vehicleId, driverId });
            if (result.ok) setDrawer(null);
            return result;
          }, "จัดรถและคนขับแล้ว")
        }
      />

      {offer ? (
        <StoreOfferForm
          quote={offer}
          booking={booking}
          vehicle={vehicle}
          driver={driver}
          onClose={() => setOffer(null)}
          onSaved={(message) => {
            setOffer(null);
            setSuccess(message);
            router.refresh();
          }}
        />
      ) : null}

      {detailsOpen && currentQuote ? (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-navy-950/40" onClick={() => setDetailsOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">ข้อเสนอที่ส่ง</h2>
              <button type="button" onClick={() => setDetailsOpen(false)} className="text-sm text-muted">
                ปิด
              </button>
            </div>
            <QuotationDocument
              quotation={currentQuote}
              booking={record.booking}
              business={record.business}
              customer={record.customer}
              itinerary={record.itinerary}
            />
          </aside>
        </div>
      ) : null}

      {drawer === "receive" ? (
        <ReceiveMoneyDrawer
          bookingId={booking.id}
          defaultDeposit={Math.max(0, (settlement.expectedDeposit ?? 0) - settlement.depositReceived)}
          defaultService={Math.max(
            0,
            (settlement.remainingBalance ?? 0) -
              Math.max(0, (settlement.expectedDeposit ?? 0) - settlement.depositReceived),
          )}
          defaultTip={0}
          accounts={accounts}
          defaultAccountId={record.receivingAccount?.id ?? null}
          onClose={() => setDrawer(null)}
          onDone={(message) => {
            setSuccess(message);
            router.refresh();
          }}
        />
      ) : null}
      {drawer === "payout" ? (
        <PayoutDrawer
          bookingId={booking.id}
          defaultFee={settlement.driverDue}
          defaultTip={settlement.tipDue}
          drivers={drivers}
          defaultPayee={driver}
          accounts={accounts}
          defaultAccountId={record.receivingAccount?.id ?? null}
          onClose={() => setDrawer(null)}
          onDone={(message) => {
            setSuccess(message);
            router.refresh();
          }}
        />
      ) : null}
      {reviewProof ? (
        <SlipReviewDrawer
          proof={reviewProof}
          expectedAmount={
            reviewProof.paymentIntent === "DEPOSIT"
              ? settlement.expectedDeposit
              : reviewProof.paymentIntent === "TIP_RECEIVED"
                ? null
                : settlement.remainingBalance
          }
          onClose={() => setReviewProof(null)}
          onDone={(message) => {
            setSuccess(message);
            router.refresh();
          }}
        />
      ) : null}
      {cancelOpen ? (
        <CancelBookingSheet
          booking={booking}
          onClose={() => setCancelOpen(false)}
          onDone={() => {
            setCancelOpen(false);
            setSuccess("ยกเลิกงานแล้ว");
            router.refresh();
          }}
        />
      ) : null}
      <JobCloseoutPanel
        open={closeoutOpen}
        booking={booking}
        movements={record.movements}
        vehicle={vehicle ?? null}
        driver={driver ?? null}
        onClose={() => setCloseoutOpen(false)}
        onDone={() => {
          setCloseoutOpen(false);
          setSuccess("จบงานแล้ว");
          router.refresh();
        }}
      />
    </div>
  );
}

function DriverJobLinkPanel({
  token,
  firstOpenedAt,
  days,
}: {
  token: string;
  firstOpenedAt: string | null;
  days: { dayNumber: number; status: "NOT_STARTED" | "ACTIVE" | "DAY_COMPLETED" }[];
}) {
  const path = driverJobPath(token);
  const [copied, setCopied] = useState(false);
  const [absolute, setAbsolute] = useState(path);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setAbsolute(`${window.location.origin}${path}`);
    });
    return () => window.cancelAnimationFrame(id);
  }, [path]);

  async function copyLink() {
    const value = absolute.startsWith("http") ? absolute : `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-paper px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-navy-800">ลิงก์งานคนขับ</p>
        <span className="text-[11px] text-muted">
          {firstOpenedAt ? "เปิดแล้ว" : "ยังไม่เปิด"}
        </span>
      </div>
      <p className="break-all font-mono text-[11px] text-muted">{absolute}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="h-9 rounded-lg bg-white px-3 text-xs font-medium"
        >
          {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        </button>
        <Link
          href={path}
          target="_blank"
          className="inline-flex h-9 items-center rounded-lg bg-[color:var(--store-primary,#0F3D3E)] px-3 text-xs font-medium text-white"
        >
          เปิดหน้าคนขับ
        </Link>
      </div>
      {days.length > 0 ? (
        <ul className="mt-1 space-y-1 border-t border-line/60 pt-2">
          {days.map((day) => (
            <li key={day.dayNumber} className="flex items-center justify-between text-xs">
              <span>วัน {day.dayNumber}</span>
              <span className="text-muted">{DRIVER_DAY_STATUS_LABEL[day.status]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
