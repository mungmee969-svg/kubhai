import type { QuotationDepositType, QuotationItemType, QuotationStatus } from "./enums";
import { bookingSpanDays } from "./fleet";
import { money } from "./settlement";
import type { Booking, Customer, Quotation, Vehicle } from "./types";

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "ร่าง",
  SENT: "ส่งแล้ว",
  CUSTOMER_ACCEPTED: "ยืนยันแล้ว",
  CUSTOMER_CHANGE_REQUESTED: "ลูกค้าขอแก้",
  CUSTOMER_REJECTED: "ปฏิเสธ",
  EXPIRED: "หมดอายุ",
  SUPERSEDED: "ถูกแทนที่",
  CANCELLED: "ยกเลิก",
};

export const QUOTATION_ITEM_LABEL: Record<QuotationItemType, string> = {
  VEHICLE_SERVICE: "ค่ารถ / ค่าบริการ",
  DRIVER_SERVICE: "ค่าคนขับ",
  OVERTIME: "OT",
  PICKUP_DROPOFF: "ค่ารับ-ส่ง",
  FOOD: "ค่าอาหาร",
  TICKET: "ค่าตั๋ว",
  ACTIVITY: "ค่ากิจกรรม",
  ACCOMMODATION: "ที่พัก",
  TOLL: "ค่าทางด่วน",
  PARKING: "ค่าที่จอด",
  CUSTOM: "รายการเพิ่มเติม",
  DISCOUNT: "ส่วนลด",
};

export const DEFAULT_QUOTATION_TERMS =
  "ราคาไม่รวมค่าทางด่วน ค่าที่จอด และค่าใช้จ่ายเพิ่มเติมที่ไม่ได้ระบุในใบเสนอราคา เว้นแต่จะระบุไว้";

export const QUOTATION_TEMPLATES: { type: QuotationItemType; description: string }[] = [
  { type: "VEHICLE_SERVICE", description: "ค่ารถ / ค่าบริการ" },
  { type: "DRIVER_SERVICE", description: "ค่าคนขับ" },
  { type: "OVERTIME", description: "OT" },
  { type: "PICKUP_DROPOFF", description: "ค่ารับ-ส่ง" },
  { type: "TOLL", description: "ค่าทางด่วน" },
  { type: "PARKING", description: "ค่าที่จอด" },
  { type: "FOOD", description: "ค่าอาหาร" },
  { type: "TICKET", description: "ค่าตั๋ว" },
  { type: "ACTIVITY", description: "ค่ากิจกรรม" },
  { type: "CUSTOM", description: "รายการเพิ่มเติม" },
];

export type QuotationLineInput = {
  id?: string;
  type: QuotationItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
};

export type QuotationTotals = {
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  depositRequiredAmount: number;
  balanceAmount: number;
};

export function lineAmount(quantity: number, unitPrice: number) {
  return money(Math.max(0, quantity) * Math.max(0, unitPrice));
}

export function calculateQuotationTotals(
  items: QuotationLineInput[],
  discountAmount: number,
  depositType: QuotationDepositType,
  depositValue: number,
): QuotationTotals {
  if (items.some((item) => item.quantity < 0 || item.unitPrice < 0)) {
    throw new Error("จำนวนและราคาต้องไม่ติดลบ");
  }
  const subtotal = items
    .filter((item) => item.type !== "DISCOUNT")
    .reduce((sum, item) => sum + lineAmount(item.quantity, item.unitPrice), 0);
  const itemDiscount = items
    .filter((item) => item.type === "DISCOUNT")
    .reduce((sum, item) => sum + lineAmount(item.quantity, item.unitPrice), 0);
  const discount = Math.min(subtotal, money(discountAmount) + itemDiscount);
  const totalAmount = Math.max(0, subtotal - discount);
  let depositRequiredAmount = 0;
  if (depositType === "FIXED_AMOUNT") {
    depositRequiredAmount = money(depositValue);
  } else if (depositType === "PERCENTAGE") {
    if (depositValue < 0 || depositValue > 100) throw new Error("เปอร์เซ็นต์มัดจำต้องอยู่ระหว่าง 0-100");
    depositRequiredAmount = money((totalAmount * depositValue) / 100);
  }
  if (depositRequiredAmount > totalAmount) throw new Error("มัดจำต้องไม่เกินยอดรวม");
  return {
    subtotal,
    discountAmount: discount,
    totalAmount,
    depositRequiredAmount,
    balanceAmount: totalAmount - depositRequiredAmount,
  };
}

export function assertSendable(items: QuotationLineInput[], totals: QuotationTotals) {
  if (!items.length) throw new Error("ต้องมีอย่างน้อย 1 รายการ");
  if (items.some((item) => !item.description.trim())) throw new Error("กรอกรายละเอียดทุกรายการ");
  if (totals.totalAmount < 0) throw new Error("ยอดรวมไม่ถูกต้อง");
}

export function isQuotationExpired(quotation: Pick<Quotation, "status" | "validUntil">, now = new Date()) {
  if (quotation.status === "EXPIRED") return true;
  if (quotation.status !== "SENT") return false;
  if (!quotation.validUntil) return false;
  return new Date(quotation.validUntil).getTime() <= now.getTime();
}

export function effectiveQuotationStatus(quotation: Quotation, now = new Date()): QuotationStatus {
  if (quotation.status === "SENT" && isQuotationExpired(quotation, now)) return "EXPIRED";
  return quotation.status;
}

export function isCustomerVisible(quotation: Quotation, now = new Date()) {
  const status = effectiveQuotationStatus(quotation, now);
  return status !== "DRAFT" && status !== "CANCELLED";
}

export function currentAdminQuotation<T extends Quotation>(quotations: T[], now = new Date()) {
  const ranked = [...quotations].sort((a, b) => b.version - a.version || b.updatedAt.localeCompare(a.updatedAt));
  return (
    ranked.find((item) => {
      const status = effectiveQuotationStatus(item, now);
      return status === "DRAFT" || status === "SENT" || status === "CUSTOMER_CHANGE_REQUESTED" || status === "CUSTOMER_ACCEPTED";
    }) ??
    ranked[0] ??
    null
  );
}

export function currentCustomerQuotation<T extends Quotation>(quotations: T[], acceptedId: string | null, now = new Date()) {
  if (acceptedId) {
    const accepted = quotations.find((item) => item.id === acceptedId);
    if (accepted) return accepted;
  }
  return (
    [...quotations]
      .filter((item) => isCustomerVisible(item, now))
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}

export function applyAcceptedCommercials(booking: Booking, quotation: Quotation) {
  booking.acceptedQuotationId = quotation.id;
  booking.quotedTotal = quotation.totalAmount;
  booking.depositAmount = quotation.depositRequiredAmount;
  booking.balanceAmount = quotation.balanceAmount;
}

export function quotationAttention(quotations: Quotation[], booking: Booking, now = new Date()) {
  const current = currentAdminQuotation(quotations, now);
  if (!current) return booking.status === "AVAILABLE" || booking.status === "CHECKING_AVAILABILITY" ? "ยังไม่มีใบเสนอราคา" : null;
  const status = effectiveQuotationStatus(current, now);
  if (status === "CUSTOMER_CHANGE_REQUESTED") return "ลูกค้าขอแก้ไขใบเสนอราคา";
  if (status === "DRAFT") return "ยังไม่ได้ส่งใบเสนอราคา";
  if (status === "SENT") return "รอลูกค้ายืนยัน";
  if (status === "EXPIRED") return "ใบเสนอราคาหมดอายุ";
  if (status === "CUSTOMER_REJECTED") return "ลูกค้าปฏิเสธใบเสนอราคา";
  if (status === "CUSTOMER_ACCEPTED" && booking.status === "WAITING_DEPOSIT") return "รอมัดจำ";
  if (status === "CUSTOMER_ACCEPTED") return "ยืนยันราคาแล้ว";
  return null;
}

export function listQuotationAttention(quotations: Quotation[], booking: Booking, now = new Date()) {
  const current = currentAdminQuotation(quotations, now);
  if (!current) return "ยังไม่มีใบเสนอราคา";
  const status = effectiveQuotationStatus(current, now);
  if (status === "CUSTOMER_CHANGE_REQUESTED") return "ลูกค้าขอแก้";
  if (status === "DRAFT") return "ยังไม่มีใบเสนอราคา";
  if (status === "SENT") return "รอลูกค้ายืนยัน";
  if (status === "EXPIRED") return "หมดอายุ";
  if (status === "CUSTOMER_REJECTED") return "ปฏิเสธราคา";
  if (status === "CUSTOMER_ACCEPTED" && booking.status === "WAITING_DEPOSIT") return "รอมัดจำ";
  if (status === "CUSTOMER_ACCEPTED") return "ยืนยันราคาแล้ว";
  return QUOTATION_STATUS_LABEL[status];
}

export function seedQuotationLines(booking: Booking, vehicle: Vehicle | null): QuotationLineInput[] {
  const days = bookingSpanDays(booking);
  const lines: QuotationLineInput[] = [
    {
      type: "VEHICLE_SERVICE",
      description: vehicle
        ? `${vehicle.brand} ${vehicle.model} · ${days} วัน`
        : `ค่ารถ / ค่าบริการ · ${days} วัน`,
      quantity: days,
      unitPrice: vehicle?.basePrice ?? 0,
    },
  ];
  if (booking.assignedDriverId) {
    lines.push({
      type: "DRIVER_SERVICE",
      description: "ค่าคนขับ",
      quantity: days,
      unitPrice: 0,
    });
  }
  return lines;
}

export function companyBilling(booking: Booking, customer: Customer | null) {
  if (booking.customerType !== "COMPANY") return null;
  return {
    companyName: customer?.companyName ?? booking.companyName,
    taxId: customer?.taxId ?? booking.taxId,
    branchType: customer?.branchType ?? null,
    branchNumber: customer?.branchNumber ?? null,
    address: customer?.taxInvoiceAddress ?? null,
    invoiceEmail: customer?.invoiceEmail ?? booking.customerEmailSnapshot,
  };
}

export function nextQuotationNumber(existing: string[], prefix: string, now = new Date()) {
  const y = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).replaceAll("-", "");
  const head = `${prefix}-${y}-`;
  let max = 0;
  for (const value of existing) {
    if (!value.startsWith(head)) continue;
    const seq = Number(value.slice(head.length));
    if (Number.isFinite(seq)) max = Math.max(max, seq);
  }
  return `${head}${String(max + 1).padStart(4, "0")}`;
}
