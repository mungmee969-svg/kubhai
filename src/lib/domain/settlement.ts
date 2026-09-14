import type { Booking, MoneyAllocation, MoneyAllocationKind, MoneyMovement } from "./types";

export type FinanceState =
  | "NONE"
  | "WAITING_DEPOSIT"
  | "WAITING_BALANCE"
  | "CUSTOMER_PAID"
  | "WAITING_DRIVER_PAYOUT"
  | "WAITING_TIP_PAYOUT"
  | "CLOSED";

export const FINANCE_LABEL: Record<FinanceState, string> = {
  NONE: "ยังไม่มียอด",
  WAITING_DEPOSIT: "รอมัดจำ",
  WAITING_BALANCE: "รอยอดคงเหลือ",
  CUSTOMER_PAID: "ลูกค้าชำระครบ",
  WAITING_DRIVER_PAYOUT: "รอจ่ายค่าตัว",
  WAITING_TIP_PAYOUT: "รอส่งทิป",
  CLOSED: "ปิดการเงินแล้ว",
};

export const FINANCE_BADGE: Record<FinanceState, string> = {
  NONE: "bg-paper text-muted",
  WAITING_DEPOSIT: "bg-accent/20 text-navy-800",
  WAITING_BALANCE: "bg-accent/20 text-navy-800",
  CUSTOMER_PAID: "bg-success/15 text-success",
  WAITING_DRIVER_PAYOUT: "bg-navy-800/10 text-navy-800",
  WAITING_TIP_PAYOUT: "bg-navy-800/10 text-navy-800",
  CLOSED: "bg-success/15 text-success",
};

const IN_KINDS: MoneyAllocationKind[] = ["DEPOSIT", "SERVICE_BALANCE", "TIP_RECEIVED"];
const OUT_KINDS: MoneyAllocationKind[] = ["DRIVER_PAYOUT", "TIP_PAYOUT", "PARTNER_PAYOUT"];

export function money(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

export function allocationsTotal(items: MoneyAllocation[]): number {
  return items.reduce((sum, item) => sum + money(item.amount), 0);
}

export function assertAllocationMatch(transferAmount: number, allocations: MoneyAllocation[]) {
  const transfer = money(transferAmount);
  const allocated = allocationsTotal(allocations);
  if (transfer <= 0) throw new Error("ยอดโอนจริงต้องมากกว่า 0");
  if (allocations.some((item) => money(item.amount) < 0)) throw new Error("ยอดแบ่งต้องไม่ติดลบ");
  if (allocated !== transfer) {
    throw new Error(`ยอดแบ่ง ${allocated} ไม่เท่ากับยอดโอนจริง ${transfer}`);
  }
}

export function sumKind(movements: MoneyMovement[], kind: MoneyAllocationKind): number {
  return movements.reduce((sum, movement) => {
    return sum + allocationsTotal(movement.allocations.filter((item) => item.kind === kind));
  }, 0);
}

export type Settlement = {
  serviceTotal: number | null;
  expectedDeposit: number | null;
  driverFee: number | null;
  depositReceived: number;
  serviceReceived: number;
  customerPaidService: number;
  remainingBalance: number | null;
  tipReceived: number;
  customerPaidTotal: number;
  driverPaid: number;
  partnerPaid: number;
  tipPaidOut: number;
  payoutPaid: number;
  driverDue: number;
  tipDue: number;
  state: FinanceState;
  label: string;
};

export function settleBooking(booking: Booking, movements: MoneyMovement[]): Settlement {
  const serviceTotal = booking.quotedTotal;
  const expectedDeposit = booking.depositAmount;
  const driverFee = booking.driverFeeAmount;
  const depositReceived = sumKind(movements, "DEPOSIT");
  const serviceReceived = sumKind(movements, "SERVICE_BALANCE");
  const tipReceived = sumKind(movements, "TIP_RECEIVED");
  const customerPaidService = depositReceived + serviceReceived;
  const remainingBalance =
    serviceTotal === null ? null : Math.max(0, money(serviceTotal) - customerPaidService);
  const customerPaidTotal = customerPaidService + tipReceived;
  const driverPaid = sumKind(movements, "DRIVER_PAYOUT");
  const partnerPaid = sumKind(movements, "PARTNER_PAYOUT");
  const tipPaidOut = sumKind(movements, "TIP_PAYOUT");
  const payoutPaid = driverPaid + partnerPaid;
  const driverDue = Math.max(0, money(driverFee) - payoutPaid);
  const tipDue = Math.max(0, tipReceived - tipPaidOut);

  let state: FinanceState = "NONE";
  if (serviceTotal === null && !movements.length && driverFee === null) {
    state = "NONE";
  } else if (remainingBalance !== null && remainingBalance > 0) {
    const depositGap = money(expectedDeposit) - depositReceived;
    state =
      booking.status === "WAITING_DEPOSIT" && depositGap > 0 ? "WAITING_DEPOSIT" : "WAITING_BALANCE";
  } else if (driverDue > 0) {
    state = remainingBalance === 0 ? "WAITING_DRIVER_PAYOUT" : "WAITING_DRIVER_PAYOUT";
  } else if (tipDue > 0) {
    state = "WAITING_TIP_PAYOUT";
  } else if (serviceTotal !== null || movements.length || driverFee !== null) {
    state = remainingBalance === 0 && driverDue === 0 && tipDue === 0 ? "CLOSED" : "CUSTOMER_PAID";
  }

  if (state === "CLOSED" && remainingBalance === 0 && driverDue === 0 && tipDue === 0 && driverFee === null && tipReceived === 0) {
    state = "CUSTOMER_PAID";
  }

  return {
    serviceTotal,
    expectedDeposit,
    driverFee,
    depositReceived,
    serviceReceived,
    customerPaidService,
    remainingBalance,
    tipReceived,
    customerPaidTotal,
    driverPaid,
    partnerPaid,
    tipPaidOut,
    payoutPaid,
    driverDue,
    tipDue,
    state,
    label: FINANCE_LABEL[state],
  };
}

export function isOpenJob(booking: Booking) {
  return booking.status !== "CANCELLED" && booking.status !== "REJECTED";
}

export function attentionReason(
  booking: Booking,
  settlement: Settlement,
  extras?: { pendingProof?: boolean; quotationAttention?: string | null },
): string | null {
  if (extras?.quotationAttention === "ลูกค้าขอแก้ไขใบเสนอราคา" || extras?.quotationAttention === "ลูกค้าขอแก้") {
    return extras.quotationAttention;
  }
  if (extras?.pendingProof) return "รอตรวจสอบสลิป";
  if (extras?.quotationAttention) return extras.quotationAttention;
  if (!isOpenJob(booking) && settlement.state !== "WAITING_BALANCE" && settlement.state !== "WAITING_DRIVER_PAYOUT" && settlement.state !== "WAITING_TIP_PAYOUT") {
    return null;
  }
  if (isOpenJob(booking) && booking.status !== "COMPLETED" && !booking.assignedVehicleId) return "ยังไม่มีรถ";
  if (isOpenJob(booking) && booking.status !== "COMPLETED" && !booking.assignedDriverId) return "ยังไม่มีคนขับ";
  if (booking.status === "CHECKING_AVAILABILITY") return "รอตรวจสอบรถ";
  if (booking.status === "AVAILABLE") return "รอเสนอราคา";
  if (booking.status === "CUSTOMER_CONFIRMED") return "ลูกค้ายืนยัน รอดำเนินการ";
  if (settlement.state === "WAITING_DEPOSIT") return "รอมัดจำ";
  if (settlement.state === "WAITING_BALANCE") {
    return booking.status === "COMPLETED" ? "เสร็จสิ้น • ค้างชำระ" : "รอยอดคงเหลือ";
  }
  if (settlement.state === "WAITING_DRIVER_PAYOUT") return "รอจ่ายค่าตัว";
  if (settlement.state === "WAITING_TIP_PAYOUT") return "รอส่งทิป";
  return null;
}

export function needsAttention(
  booking: Booking,
  settlement: Settlement,
  extras?: { pendingProof?: boolean; quotationAttention?: string | null },
): boolean {
  if (extras?.quotationAttention === "ลูกค้าขอแก้ไขใบเสนอราคา" || extras?.quotationAttention === "ลูกค้าขอแก้") {
    return true;
  }
  if (extras?.pendingProof) return true;
  if (booking.status === "REQUESTED") return false;
  if (booking.status === "CHECKING_AVAILABILITY") return true;
  if (booking.status === "AVAILABLE") return true;
  if (booking.status === "CUSTOMER_CONFIRMED") return true;
  if (isOpenJob(booking) && booking.status !== "COMPLETED" && !booking.assignedVehicleId) return true;
  if (isOpenJob(booking) && booking.status !== "COMPLETED" && !booking.assignedDriverId) return true;
  if (settlement.state === "WAITING_DEPOSIT") return true;
  if (settlement.state === "WAITING_BALANCE") return true; // includes COMPLETED + outstanding
  if (booking.status === "COMPLETED" && (settlement.state === "WAITING_DRIVER_PAYOUT" || settlement.state === "WAITING_TIP_PAYOUT")) {
    return true;
  }
  return false;
}

export function incomingKinds(): MoneyAllocationKind[] {
  return IN_KINDS;
}

export function outgoingKinds(): MoneyAllocationKind[] {
  return OUT_KINDS;
}

export function financePageMatch(state: FinanceState, filter: string) {
  if (filter === "ALL" || !filter) return true;
  if (filter === "RECEIVABLE") return state === "WAITING_DEPOSIT" || state === "WAITING_BALANCE";
  if (filter === "CUSTOMER_PAID") return state === "CUSTOMER_PAID" || state === "WAITING_DRIVER_PAYOUT" || state === "WAITING_TIP_PAYOUT" || state === "CLOSED";
  if (filter === "WAITING_DRIVER") return state === "WAITING_DRIVER_PAYOUT";
  if (filter === "WAITING_TIP") return state === "WAITING_TIP_PAYOUT";
  if (filter === "CLOSED") return state === "CLOSED";
  return state === filter;
}
