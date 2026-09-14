import { assertAllocationMatch, money } from "./settlement";
import type {
  MoneyAllocation,
  PaymentAccount,
  PaymentAccountSnapshot,
  PaymentAccountType,
  PaymentProof,
  PaymentProofIntent,
  PaymentProofReviewStatus,
} from "./types";

export const PAYMENT_ACCOUNT_TYPES: PaymentAccountType[] = ["BANK_ACCOUNT", "PROMPTPAY", "OTHER"];

export const PAYMENT_PROOF_INTENTS: PaymentProofIntent[] = [
  "DEPOSIT",
  "SERVICE_BALANCE",
  "TIP_RECEIVED",
  "COMBINED_BALANCE_AND_TIP",
];

export const INTENT_LABEL: Record<PaymentProofIntent, string> = {
  DEPOSIT: "มัดจำ",
  SERVICE_BALANCE: "ยอดคงเหลือ",
  TIP_RECEIVED: "ทิป",
  COMBINED_BALANCE_AND_TIP: "ยอดคงเหลือ + ทิป",
};

export const REVIEW_LABEL: Record<PaymentProofReviewStatus, string> = {
  PENDING_REVIEW: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

export const REJECT_REASONS = [
  "ยอดไม่ตรง",
  "โอนผิดบัญชี",
  "สลิปไม่ชัด",
  "สลิปซ้ำ",
  "ไม่พบรายการ",
  "ข้อมูลไม่ตรง",
  "อื่นๆ",
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return "xxx-x-xxxx-x";
  const last4 = digits.slice(-4).padStart(4, "x");
  return `xxx-x-x${last4}-x`;
}

export function snapshotAccount(account: PaymentAccount): PaymentAccountSnapshot {
  return {
    id: account.id,
    displayName: account.displayName,
    accountType: account.accountType,
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountHolderName: account.accountHolderName,
    accountNumber: account.accountNumber,
    accountNumberMasked: maskAccountNumber(account.accountNumber),
    promptPayId: account.promptPayId,
  };
}

export function publicAccountSnapshot(
  snapshot: PaymentAccountSnapshot | null,
): PaymentAccountSnapshot | null {
  if (!snapshot) return null;
  return {
    ...snapshot,
    accountNumber: snapshot.accountNumberMasked,
  };
}

export function publicPaymentAccount(account: PaymentAccount): PaymentAccount {
  return {
    ...account,
    accountNumber: maskAccountNumber(account.accountNumber),
    qrImagePath: account.qrDisplayEnabled ? account.qrImagePath : null,
  };
}

export function defaultPaymentAccount(accounts: PaymentAccount[]): PaymentAccount | null {
  return (
    accounts.find((item) => item.isActive && item.isDefault) ??
    accounts.find((item) => item.isActive) ??
    null
  );
}

export function accountForBooking(
  receivingAccountId: string | null | undefined,
  accounts: PaymentAccount[],
): PaymentAccount | null {
  if (receivingAccountId) {
    const selected = accounts.find((item) => item.id === receivingAccountId);
    if (selected) return selected;
  }
  return defaultPaymentAccount(accounts);
}

export function formatAccountLine(account: PaymentAccount | PaymentAccountSnapshot | null): string {
  if (!account) return "ยังไม่ได้เลือกบัญชี";
  const number = "accountNumberMasked" in account ? account.accountNumberMasked : maskAccountNumber(account.accountNumber);
  return [account.bankName, account.accountHolderName, number].filter(Boolean).join(" · ");
}

export function movementAccountLabel(input: {
  snapshot: PaymentAccountSnapshot | null;
  legacyAccountUnknown?: boolean;
}): string {
  if (input.snapshot) return formatAccountLine(input.snapshot);
  return "ไม่พบข้อมูลบัญชีเดิม";
}

export function allocationsFromIntent(
  intent: PaymentProofIntent,
  claimedAmount: number,
  serviceAmount?: number | null,
  tipAmount?: number | null,
): MoneyAllocation[] {
  const claimed = money(claimedAmount);
  if (intent === "DEPOSIT") return [{ kind: "DEPOSIT", amount: claimed }];
  if (intent === "SERVICE_BALANCE") return [{ kind: "SERVICE_BALANCE", amount: claimed }];
  if (intent === "TIP_RECEIVED") return [{ kind: "TIP_RECEIVED", amount: claimed }];
  const service = money(serviceAmount);
  const tip = money(tipAmount);
  const allocations: MoneyAllocation[] = [];
  if (service > 0) allocations.push({ kind: "SERVICE_BALANCE", amount: service });
  if (tip > 0) allocations.push({ kind: "TIP_RECEIVED", amount: tip });
  return allocations;
}

export function validateProofAllocations(claimedAmount: number, allocations: MoneyAllocation[]) {
  const incoming = allocations.every(
    (item) => item.kind === "DEPOSIT" || item.kind === "SERVICE_BALANCE" || item.kind === "TIP_RECEIVED",
  );
  if (!incoming) throw new Error("สลิปนี้แบ่งได้เฉพาะเงินรับจากลูกค้า");
  assertAllocationMatch(claimedAmount, allocations);
}

export function proofHasPending(proofs: PaymentProof[]) {
  return proofs.some((item) => item.reviewStatus === "PENDING_REVIEW");
}

export function publicPaymentProof(proof: PaymentProof): PaymentProof {
  return {
    ...proof,
    receivingAccountSnapshot: publicAccountSnapshot(proof.receivingAccountSnapshot),
    adminNote: null,
    reviewedBy: null,
  };
}
