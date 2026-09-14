import type { BookingStatus } from "./enums";

export type StatusTone = "attention" | "progress" | "wait" | "success" | "active" | "done" | "danger";

export type StatusPresentation = {
  label: string;
  shortLabel: string;
  tone: StatusTone;
  badgeClass: string;
  dotClass: string;
};

const MAP: Record<BookingStatus, StatusPresentation> = {
  REQUESTED: {
    label: "คำขอใหม่",
    shortLabel: "คำขอใหม่",
    tone: "attention",
    badgeClass: "bg-accent/20 text-navy-800",
    dotClass: "bg-accent-deep",
  },
  CHECKING_AVAILABILITY: {
    label: "กำลังตรวจสอบรถ",
    shortLabel: "ตรวจสอบรถ",
    tone: "progress",
    badgeClass: "bg-navy-800/10 text-navy-800",
    dotClass: "bg-navy-600",
  },
  AVAILABLE: {
    label: "รอเสนอราคา",
    shortLabel: "รอเสนอราคา",
    tone: "wait",
    badgeClass: "bg-navy-600/10 text-navy-700",
    dotClass: "bg-navy-500",
  },
  QUOTATION_SENT: {
    label: "ส่งราคาแล้ว",
    shortLabel: "รอลูกค้ายืนยัน",
    tone: "wait",
    badgeClass: "bg-accent/15 text-navy-800",
    dotClass: "bg-accent-deep",
  },
  CUSTOMER_CONFIRMED: {
    label: "ลูกค้ายืนยัน",
    shortLabel: "ลูกค้ายืนยัน",
    tone: "progress",
    badgeClass: "bg-navy-700/10 text-navy-800",
    dotClass: "bg-navy-700",
  },
  WAITING_DEPOSIT: {
    label: "รอมัดจำ",
    shortLabel: "รอมัดจำ",
    tone: "attention",
    badgeClass: "bg-accent-deep/15 text-navy-800",
    dotClass: "bg-accent-deep",
  },
  CONFIRMED: {
    label: "ยืนยันแล้ว",
    shortLabel: "ยืนยันแล้ว",
    tone: "success",
    badgeClass: "bg-success/15 text-success",
    dotClass: "bg-success",
  },
  IN_PROGRESS: {
    label: "กำลังเดินทาง",
    shortLabel: "กำลังเดินทาง",
    tone: "active",
    badgeClass: "bg-navy-800 text-white",
    dotClass: "bg-navy-800",
  },
  COMPLETED: {
    label: "เสร็จสิ้น",
    shortLabel: "เสร็จสิ้น",
    tone: "done",
    badgeClass: "bg-line text-muted",
    dotClass: "bg-muted",
  },
  CANCELLED: {
    label: "ยกเลิก",
    shortLabel: "ยกเลิก",
    tone: "danger",
    badgeClass: "bg-danger/10 text-danger",
    dotClass: "bg-danger",
  },
  REJECTED: {
    label: "ปฏิเสธ",
    shortLabel: "ปฏิเสธ",
    tone: "danger",
    badgeClass: "bg-danger/10 text-danger",
    dotClass: "bg-danger",
  },
};

export const WORKFLOW_STEPS: BookingStatus[] = [
  "REQUESTED",
  "CHECKING_AVAILABILITY",
  "AVAILABLE",
  "QUOTATION_SENT",
  "CUSTOMER_CONFIRMED",
  "WAITING_DEPOSIT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
];

export function statusPresentation(status: BookingStatus): StatusPresentation {
  return MAP[status];
}

export function statusLabel(status: BookingStatus): string {
  return MAP[status].label;
}

/** Customer-facing labels — never expose raw enum names. */
const CUSTOMER_LABELS: Record<BookingStatus, string> = {
  REQUESTED: "ส่งคำขอแล้ว",
  CHECKING_AVAILABILITY: "ร้านกำลังตรวจสอบ",
  AVAILABLE: "รอข้อเสนอ",
  QUOTATION_SENT: "ได้รับข้อเสนอ",
  CUSTOMER_CONFIRMED: "รอชำระมัดจำ",
  WAITING_DEPOSIT: "กำลังตรวจสอบการชำระเงิน",
  CONFIRMED: "ยืนยันการจองแล้ว",
  IN_PROGRESS: "กำลังให้บริการ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
  REJECTED: "ปฏิเสธ",
};

export function customerStatusPresentation(status: BookingStatus): StatusPresentation {
  const base = MAP[status];
  const label = CUSTOMER_LABELS[status];
  return { ...base, label, shortLabel: label };
}

export function customerStatusLabel(status: BookingStatus): string {
  return CUSTOMER_LABELS[status];
}

export function customerStatusMessageKey(status: BookingStatus): string {
  return `status.${status}`;
}

/**
 * Store-side status CTAs only.
 * Customer acceptance (QUOTATION_SENT → CUSTOMER_CONFIRMED) must come from
 * the customer quotation flow — never a store impersonation button.
 */
export const PRIMARY_ACTION: Partial<Record<BookingStatus, { to: BookingStatus; label: string }>> = {
  REQUESTED: { to: "CHECKING_AVAILABILITY", label: "เริ่มตรวจสอบ" },
  CHECKING_AVAILABILITY: { to: "AVAILABLE", label: "พร้อมเสนอราคา" },
  CUSTOMER_CONFIRMED: { to: "WAITING_DEPOSIT", label: "รอรับมัดจำ" },
  CONFIRMED: { to: "IN_PROGRESS", label: "เริ่มงาน" },
  IN_PROGRESS: { to: "COMPLETED", label: "จบงาน" },
};
