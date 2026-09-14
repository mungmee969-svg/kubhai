import type { BookingStatus } from "./enums";

const TERMINAL: BookingStatus[] = ["COMPLETED", "CANCELLED", "REJECTED"];

const FORWARD: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ["CHECKING_AVAILABILITY", "AVAILABLE", "QUOTATION_SENT", "REJECTED", "CANCELLED"],
  CHECKING_AVAILABILITY: [
    "AVAILABLE",
    "QUOTATION_SENT",
    "REQUESTED",
    "REJECTED",
    "CANCELLED",
  ],
  AVAILABLE: [
    "QUOTATION_SENT",
    "CHECKING_AVAILABILITY",
    "REJECTED",
    "CANCELLED",
  ],
  QUOTATION_SENT: [
    "CUSTOMER_CONFIRMED",
    "WAITING_DEPOSIT",
    "AVAILABLE",
    "REJECTED",
    "CANCELLED",
  ],
  CUSTOMER_CONFIRMED: ["WAITING_DEPOSIT", "CONFIRMED", "CANCELLED"],
  WAITING_DEPOSIT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  if (from === to) return true;
  return FORWARD[from].includes(to);
}

export function isBlockingStatus(status: BookingStatus): boolean {
  return status === "CONFIRMED" || status === "IN_PROGRESS";
}

export function isTerminalStatus(status: BookingStatus): boolean {
  return TERMINAL.includes(status);
}

export function revealsAssignment(status: BookingStatus): boolean {
  return (
    status === "CONFIRMED" ||
    status === "IN_PROGRESS" ||
    status === "COMPLETED"
  );
}

export function inboxGroups(): BookingStatus[] {
  return [
    "REQUESTED",
    "CHECKING_AVAILABILITY",
    "AVAILABLE",
    "QUOTATION_SENT",
    "CUSTOMER_CONFIRMED",
    "WAITING_DEPOSIT",
    "CONFIRMED",
    "IN_PROGRESS",
  ];
}
