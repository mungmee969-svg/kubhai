import { formatDuration } from "./fleet";
import { formatMoney, formatThaiDate } from "./ops";
import { currentAdminQuotation, effectiveQuotationStatus } from "./quotation";
import type { Settlement } from "./settlement";
import { statusPresentation } from "./status-ui";
import type { Booking, Quotation } from "./types";
import type { BookingStatus } from "./enums";
import { SERVICE_TYPE_LABELS } from "./enums";

/** Inbox quick filters — owner language, not raw enums. */
export const OPS_INBOX_FILTERS = [
  { key: "NEW", label: "รายการใหม่" },
  { key: "ACTION", label: "ดำเนินการ" },
  { key: "REVIEW", label: "ตรวจสอบ" },
  { key: "CONFIRMED", label: "ยืนยันแล้ว" },
  { key: "ALL", label: "ทั้งหมด" },
] as const;

export type OpsInboxFilter = (typeof OPS_INBOX_FILTERS)[number]["key"];

export type OpsNextActionKind =
  | "REVIEW_AND_ASSIGN"
  | "ASSIGN"
  | "CREATE_OFFER"
  | "SEND_OFFER"
  | "WAIT_CUSTOMER"
  | "WAIT_DEPOSIT"
  | "REVIEW_PROOF"
  | "PREPARE_TRIP"
  | "START_JOB"
  | "COMPLETE_JOB"
  | "SETTLE"
  | "NONE";

export type OpsNextAction = {
  kind: OpsNextActionKind;
  title: string;
  description: string;
  checklist: { done: boolean; label: string }[];
  /** Sticky primary CTA label — null when waiting / no action */
  ctaLabel: string | null;
  /** Operational progress step 1–4 for early funnel */
  progressStep: 1 | 2 | 3 | 4;
};

export type OpsCardTone = "attention" | "wait" | "ready" | "neutral" | "done" | "danger";

export type OpsCardSummary = {
  statusLabel: string;
  tone: OpsCardTone;
  attention: string | null;
  relativeTime: string;
  dateRangeLabel: string;
  durationLabel: string;
  routeFrom: string;
  routeTo: string | null;
  serviceLabel: string;
  passengersLabel: string;
  luggageLabel: string | null;
  nextCtaLabel: string | null;
};

/** Store is actively preparing (not brand-new, not payment-review, not confirmed ops). */
const ACTION_STATUSES: BookingStatus[] = [
  "CHECKING_AVAILABILITY",
  "AVAILABLE",
];
const CONFIRMED_BUCKET: BookingStatus[] = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"];

export function matchesOpsInboxFilter(
  booking: Booking,
  settlement: Settlement,
  filter: string,
  extras?: {
    pendingProof?: boolean;
    quotationAttention?: string | null;
    quotations?: Quotation[];
  },
): boolean {
  if (filter === "ALL" || !filter) return true;
  if (filter === "NEW") {
    // Brand-new: not yet handled (no vehicle/driver assign yet)
    return (
      booking.status === "REQUESTED" &&
      !booking.assignedVehicleId &&
      !booking.assignedDriverId
    );
  }
  if (filter === "REVIEW") {
    return Boolean(extras?.pendingProof);
  }
  if (filter === "CONFIRMED") {
    return CONFIRMED_BUCKET.includes(booking.status);
  }
  if (filter === "ACTION") {
    if (extras?.pendingProof) return false;
    if (CONFIRMED_BUCKET.includes(booking.status)) return false;
    // New unhandled requests stay in รายการใหม่
    if (
      booking.status === "REQUESTED" &&
      !booking.assignedVehicleId &&
      !booking.assignedDriverId
    ) {
      return false;
    }
    if (ACTION_STATUSES.includes(booking.status)) return true;
    // Store started handling: assigned resources and/or preparing/sending offer
    if (booking.assignedVehicleId || booking.assignedDriverId) {
      if (
        booking.status === "REQUESTED" ||
        booking.status === "QUOTATION_SENT" ||
        booking.status === "CUSTOMER_CONFIRMED" ||
        booking.status === "WAITING_DEPOSIT"
      ) {
        // QUOTATION_SENT / waiting deposit without pending proof = waiting customer,
        // not store ACTION — unless still need to create/send offer
        const next = resolveBookingNextAction(
          booking,
          extras?.quotations ?? [],
          settlement,
          extras,
        );
        return (
          next.kind === "REVIEW_AND_ASSIGN" ||
          next.kind === "ASSIGN" ||
          next.kind === "CREATE_OFFER" ||
          next.kind === "SEND_OFFER" ||
          next.kind === "PREPARE_TRIP"
        );
      }
    }
    const next = resolveBookingNextAction(
      booking,
      extras?.quotations ?? [],
      settlement,
      extras,
    );
    return (
      next.kind === "REVIEW_AND_ASSIGN" ||
      next.kind === "ASSIGN" ||
      next.kind === "CREATE_OFFER" ||
      next.kind === "SEND_OFFER"
    );
  }
  // Legacy alias — waiting on customer (not a primary tab)
  if (filter === "WAITING_CUSTOMER") {
    return (
      !extras?.pendingProof &&
      (booking.status === "QUOTATION_SENT" ||
        booking.status === "CUSTOMER_CONFIRMED" ||
        booking.status === "WAITING_DEPOSIT")
    );
  }
  return false;
}

export function isOpsQuickFilter(filter: string): filter is OpsInboxFilter {
  return OPS_INBOX_FILTERS.some((item) => item.key === filter);
}

export function resolveBookingNextAction(
  booking: Booking,
  quotations: Quotation[],
  settlement: Settlement,
  extras?: { pendingProof?: boolean; quotationAttention?: string | null },
): OpsNextAction {
  const hasVehicle = Boolean(booking.assignedVehicleId);
  const hasDriver = Boolean(booking.assignedDriverId);
  const assigned = hasVehicle && hasDriver;
  const current = currentAdminQuotation(quotations);
  const currentStatus = current ? effectiveQuotationStatus(current) : null;
  const pendingProof = Boolean(extras?.pendingProof);
  const changeRequested = currentStatus === "CUSTOMER_CHANGE_REQUESTED";

  const checklist = [
    { done: assigned, label: "จัดรถและคนขับ" },
    {
      done: Boolean(current && (currentStatus === "SENT" || currentStatus === "CUSTOMER_ACCEPTED")),
      label: "ส่งข้อเสนอให้ลูกค้า",
    },
  ];

  if (booking.status === "CANCELLED" || booking.status === "REJECTED") {
    return {
      kind: "NONE",
      title: booking.status === "CANCELLED" ? "งานถูกยกเลิก" : "ปฏิเสธคำขอแล้ว",
      description: "ไม่มีขั้นตอนถัดไป",
      checklist,
      ctaLabel: null,
      progressStep: 1,
    };
  }

  if (booking.status === "COMPLETED") {
    if (
      settlement.state === "WAITING_BALANCE" ||
      settlement.state === "WAITING_DRIVER_PAYOUT" ||
      settlement.state === "WAITING_TIP_PAYOUT"
    ) {
      return {
        kind: "SETTLE",
        title: "งานเดินทางเสร็จแล้ว — ปิดการเงิน",
        description: "จัดการยอดคงเหลือ / จ่ายคนขับตามความจริงของร้าน",
        checklist,
        ctaLabel: "ปิดงานการเงิน",
        progressStep: 4,
      };
    }
    return {
      kind: "NONE",
      title: "เสร็จสิ้น",
      description: "งานนี้ปิดแล้ว",
      checklist,
      ctaLabel: null,
      progressStep: 4,
    };
  }

  if (booking.status === "IN_PROGRESS") {
    return {
      kind: "COMPLETE_JOB",
      title: "กำลังเดินทาง",
      description: "เมื่อจบงานจริง ให้จบงานและเรียกเก็บยอดที่เหลือถ้ามี",
      checklist,
      ctaLabel: settlement.remainingBalance
        ? `จบงานและเรียกเก็บ ${formatMoney(settlement.remainingBalance)}`
        : "จบงาน",
      progressStep: 4,
    };
  }

  if (booking.status === "CONFIRMED") {
    return {
      kind: "START_JOB",
      title: "ยืนยันการจองแล้ว",
      description: "เตรียมรถและเริ่มงานเมื่อถึงวันเดินทาง",
      checklist,
      ctaLabel: "เริ่มงาน",
      progressStep: 4,
    };
  }

  if (pendingProof || booking.status === "WAITING_DEPOSIT") {
    if (pendingProof) {
      return {
        kind: "REVIEW_PROOF",
        title: "ลูกค้าส่งหลักฐานแล้ว",
        description: "ตรวจสอบสลิปก่อนยืนยันการจอง",
        checklist,
        ctaLabel: "ตรวจสอบสลิป",
        progressStep: 4,
      };
    }
    return {
      kind: "WAIT_DEPOSIT",
      title: `รอมัดจำ ${formatMoney(settlement.expectedDeposit)}`,
      description: "รอลูกค้าโอนมัดจำและส่งหลักฐาน",
      checklist,
      ctaLabel: null,
      progressStep: 4,
    };
  }

  if (booking.status === "CUSTOMER_CONFIRMED") {
    return {
      kind: "WAIT_DEPOSIT",
      title: "ลูกค้ายืนยันข้อเสนอแล้ว",
      description: `รอมัดจำ ${formatMoney(settlement.expectedDeposit)}`,
      checklist,
      ctaLabel: null,
      progressStep: 4,
    };
  }

  if (booking.status === "QUOTATION_SENT" || currentStatus === "SENT") {
    return {
      kind: "WAIT_CUSTOMER",
      title: "ส่งข้อเสนอแล้ว",
      description: "รอลูกค้ายืนยันข้อเสนอ",
      checklist,
      ctaLabel: null,
      progressStep: 4,
    };
  }

  if (changeRequested) {
    return {
      kind: "CREATE_OFFER",
      title: "ลูกค้าขอแก้ไขข้อเสนอ",
      description: extras?.quotationAttention ?? "ปรับราคาแล้วส่งฉบับใหม่",
      checklist,
      ctaLabel: "แก้ไขและส่งฉบับใหม่",
      progressStep: 3,
    };
  }

  if (currentStatus === "DRAFT") {
    const readyToSend = Boolean(current && current.totalAmount > 0);
    return {
      kind: readyToSend ? "SEND_OFFER" : "CREATE_OFFER",
      title: readyToSend ? "พร้อมส่งข้อเสนอ" : "กำหนดราคา",
      description: readyToSend
        ? "ตรวจตัวอย่างแล้วส่งให้ลูกค้า"
        : "ใส่ค่าบริการ มัดจำ และเงื่อนไข OT",
      checklist,
      ctaLabel: readyToSend ? "ส่งข้อเสนอให้ลูกค้า" : "สร้างข้อเสนอ",
      progressStep: 3,
    };
  }

  // Early funnel: new request → assign → quote
  if (!assigned) {
    const early =
      booking.status === "REQUESTED" ||
      booking.status === "CHECKING_AVAILABILITY" ||
      booking.status === "AVAILABLE";
    return {
      kind: early && booking.status === "REQUESTED" ? "REVIEW_AND_ASSIGN" : "ASSIGN",
      title:
        booking.status === "REQUESTED"
          ? "ตรวจสอบทริปและจัดทำข้อเสนอให้ลูกค้า"
          : "ยังไม่ได้จัดรถและคนขับ",
      description: "ดูรายละเอียดลูกค้า ปรับแผนถ้าจำเป็น แล้วจัดรถกับคนขับ",
      checklist,
      ctaLabel: "จัดรถและคนขับ",
      progressStep: assigned ? 3 : 2,
    };
  }

  return {
    kind: "CREATE_OFFER",
    title: "พร้อมเสนอราคา",
    description: "ใส่ค่าบริการ มัดจำ และเงื่อนไขเวลา แล้วส่งให้ลูกค้า",
    checklist,
    ctaLabel: "สร้างข้อเสนอ",
    progressStep: 3,
  };
}

export function buildOpsCardSummary(
  booking: Booking,
  opts?: { attention?: string | null; now?: Date; nextCtaLabel?: string | null },
): OpsCardSummary & { nextCtaLabel: string | null } {
  const attention = opts?.attention ?? null;
  const tone = cardTone(booking.status, Boolean(attention));
  return {
    statusLabel: ownerFacingStatus(booking),
    tone,
    attention,
    relativeTime: relativeThaiTime(booking.createdAt, opts?.now),
    dateRangeLabel: dateRangeLabel(booking),
    durationLabel: formatDuration(booking),
    routeFrom: booking.pickupLocation,
    routeTo: booking.dropoffLocation,
    serviceLabel: SERVICE_TYPE_LABELS[booking.serviceType],
    passengersLabel: `${booking.passengerCount} คน`,
    luggageLabel: booking.luggageCount != null ? `${booking.luggageCount} ใบ` : null,
    nextCtaLabel: opts?.nextCtaLabel ?? null,
  };
}

export function ownerFacingStatus(booking: Booking): string {
  switch (booking.status) {
    case "REQUESTED":
      return "คำขอใหม่";
    case "CHECKING_AVAILABILITY":
      return "กำลังจัดรถ";
    case "AVAILABLE":
      return "พร้อมเสนอราคา";
    case "QUOTATION_SENT":
      return "รอลูกค้ายืนยัน";
    case "CUSTOMER_CONFIRMED":
      return "ลูกค้ายืนยันแล้ว";
    case "WAITING_DEPOSIT":
      return "รอมัดจำ";
    case "CONFIRMED":
      return "ยืนยันการจองแล้ว";
    case "IN_PROGRESS":
      return "กำลังเดินทาง";
    case "COMPLETED":
      return "เสร็จสิ้น";
    case "CANCELLED":
      return "ยกเลิก";
    case "REJECTED":
      return "ปฏิเสธ";
    default:
      return statusPresentation(booking.status).label;
  }
}

function cardTone(status: BookingStatus, hasAttention: boolean): OpsCardTone {
  if (status === "CANCELLED" || status === "REJECTED") return "danger";
  if (status === "COMPLETED") return "done";
  if (status === "REQUESTED" || hasAttention) return "attention";
  if (status === "QUOTATION_SENT" || status === "WAITING_DEPOSIT" || status === "CUSTOMER_CONFIRMED") {
    return "wait";
  }
  if (status === "CONFIRMED" || status === "IN_PROGRESS") return "ready";
  return "neutral";
}

function dateRangeLabel(booking: Booking): string {
  if (booking.endDate && booking.endDate !== booking.startDate) {
    return `${formatThaiDate(booking.startDate)} – ${formatThaiDate(booking.endDate)}`;
  }
  return formatThaiDate(booking.startDate);
}

export function relativeThaiTime(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  return formatThaiDate(iso.slice(0, 10));
}

/** Append OT terms into customer-facing terms without creating priced line items. */
export function composeOvertimeTerms(
  baseTerms: string | null | undefined,
  includedHoursPerDay: number | null | undefined,
  overtimeRatePerHour: number | null | undefined,
): string {
  const base = (baseTerms ?? "").trim();
  const parts: string[] = [];
  if (includedHoursPerDay != null && includedHoursPerDay > 0) {
    parts.push(`รวม ${includedHoursPerDay} ชั่วโมง / วัน`);
  }
  if (overtimeRatePerHour != null && overtimeRatePerHour > 0) {
    parts.push(`ค่าล่วงเวลา (OT) ${formatMoney(overtimeRatePerHour)} / ชั่วโมง`);
  }
  if (!parts.length) return base;
  const otBlock = `เงื่อนไขเวลา\n${parts.join("\n")}\n(คิดตามเวลาใช้งานจริงหลังจบงาน — ยังไม่ใช่ยอดเรียกเก็บตอนนี้)`;
  if (!base) return otBlock;
  if (base.includes("ค่าล่วงเวลา") || base.includes("ชั่วโมง / วัน")) return base;
  return `${base}\n\n${otBlock}`;
}

export const OPS_PROGRESS_LABELS = ["ตรวจสอบ", "จัดรถ", "เสนอราคา", "รอลูกค้า"] as const;
