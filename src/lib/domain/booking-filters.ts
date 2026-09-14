import { isOpsQuickFilter, matchesOpsInboxFilter } from "./booking-ops-next";
import { todayBangkok } from "./ops";
import { isOpenJob, type Settlement } from "./settlement";
import type { Booking, Quotation } from "./types";

export function matchesBookingFilter(
  booking: Booking,
  settlement: Settlement,
  filter: string,
  today = todayBangkok(),
  extras?: {
    pendingProof?: boolean;
    quotationAttention?: string | null;
    quotations?: Quotation[];
  },
) {
  if (filter === "ALL" || !filter) return true;
  if (isOpsQuickFilter(filter) && filter !== "ALL" && filter !== "ACTION") {
    return matchesOpsInboxFilter(booking, settlement, filter, extras);
  }
  if (filter === "TODAY") return booking.startDate === today;
  if (filter === "ACTION" || filter === "REVIEW") {
    return matchesOpsInboxFilter(booking, settlement, filter, extras);
  }
  if (filter === "NEW") return matchesOpsInboxFilter(booking, settlement, "NEW", extras);
  if (filter === "WAITING_CUSTOMER") {
    return matchesOpsInboxFilter(booking, settlement, "WAITING_CUSTOMER", extras);
  }
  if (filter === "NO_VEHICLE") {
    return isOpenJob(booking) && booking.status !== "COMPLETED" && !booking.assignedVehicleId;
  }
  if (filter === "NO_DRIVER") {
    return isOpenJob(booking) && booking.status !== "COMPLETED" && !booking.assignedDriverId;
  }
  if (filter === "WAITING_BALANCE") return settlement.state === "WAITING_BALANCE";
  return booking.status === filter;
}
