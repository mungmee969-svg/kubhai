import { money } from "./settlement";
import type { Settlement } from "./settlement";
import type { PaymentAccount, PaymentProofIntent } from "./types";
import { maskAccountNumber } from "./payment-accounts";

export type PaymentInstruction = {
  bookingCode: string;
  purpose: PaymentProofIntent;
  expectedAmount: number;
  serviceTotal: number | null;
  expectedDeposit: number | null;
  depositReceived: number;
  remainingBalance: number | null;
  remainingAfterDeposit: number | null;
  tipAmount: number;
  transferTotal: number;
  accountDisplayName: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumberMasked: string | null;
  promptPayId: string | null;
  qrImagePath: string | null;
  qrDisplayEnabled: boolean;
  qrIsStatic: true;
};

export function resolvePaymentPurpose(settlement: Settlement): PaymentProofIntent {
  if (settlement.state === "WAITING_DEPOSIT") return "DEPOSIT";
  if ((settlement.remainingBalance ?? 0) > 0) return "SERVICE_BALANCE";
  return "TIP_RECEIVED";
}

export function buildPaymentInstruction(input: {
  bookingCode: string;
  account: PaymentAccount | null;
  settlement: Settlement;
  purpose?: PaymentProofIntent;
  tipAmount?: number;
}): PaymentInstruction {
  const purpose = input.purpose ?? resolvePaymentPurpose(input.settlement);
  const depositDue = Math.max(
    0,
    money(input.settlement.expectedDeposit) - input.settlement.depositReceived,
  );
  const remaining = money(input.settlement.remainingBalance);
  const tip = Math.max(0, money(input.tipAmount));
  const expectedAmount =
    purpose === "DEPOSIT"
      ? depositDue
      : purpose === "TIP_RECEIVED"
        ? tip
        : purpose === "COMBINED_BALANCE_AND_TIP"
          ? remaining + tip
          : remaining;
  const remainingAfterDeposit =
    input.settlement.serviceTotal === null
      ? null
      : Math.max(0, money(input.settlement.serviceTotal) - money(input.settlement.expectedDeposit));

  return {
    bookingCode: input.bookingCode,
    purpose,
    expectedAmount,
    serviceTotal: input.settlement.serviceTotal,
    expectedDeposit: input.settlement.expectedDeposit,
    depositReceived: input.settlement.depositReceived,
    remainingBalance: input.settlement.remainingBalance,
    remainingAfterDeposit,
    tipAmount: tip,
    transferTotal: expectedAmount,
    accountDisplayName: input.account?.displayName ?? null,
    bankName: input.account?.bankName ?? null,
    accountHolderName: input.account?.accountHolderName ?? null,
    accountNumberMasked: maskAccountNumber(input.account?.accountNumber ?? null),
    promptPayId: input.account?.promptPayId ?? null,
    qrImagePath: input.account?.qrDisplayEnabled === false ? null : input.account?.qrImagePath ?? null,
    qrDisplayEnabled: Boolean(input.account?.qrDisplayEnabled && input.account.qrImagePath),
    qrIsStatic: true,
  };
}
