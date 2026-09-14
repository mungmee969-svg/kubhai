import { formatMoney } from "@/lib/domain/ops";
import { INTENT_LABEL } from "@/lib/domain/payment-accounts";
import type { PaymentInstruction } from "@/lib/domain/payment-instructions";

export function PaymentInstructions({
  instruction,
  compact = false,
}: {
  instruction: PaymentInstruction;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted">Booking {instruction.bookingCode}</p>
        <p className="mt-1 text-lg font-semibold text-navy-800">
          ยอดที่ต้องชำระ {formatMoney(instruction.expectedAmount)}
        </p>
        <p className="text-sm text-muted">{INTENT_LABEL[instruction.purpose]}</p>
      </div>

      {instruction.purpose === "DEPOSIT" ? (
        <dl className="grid gap-1 text-sm">
          <Row label="ค่าบริการทั้งหมด" value={formatMoney(instruction.serviceTotal)} />
          <Row label="มัดจำที่ต้องชำระ" value={formatMoney(instruction.expectedDeposit)} />
          <Row label="คงเหลือหลังมัดจำ" value={formatMoney(instruction.remainingAfterDeposit)} />
        </dl>
      ) : null}

      {instruction.purpose === "SERVICE_BALANCE" || instruction.purpose === "COMBINED_BALANCE_AND_TIP" ? (
        <dl className="grid gap-1 text-sm">
          <Row label="ราคางาน" value={formatMoney(instruction.serviceTotal)} />
          <Row label="รับแล้ว" value={formatMoney(instruction.depositReceived)} />
          <Row label="ยอดคงเหลือ" value={formatMoney(instruction.remainingBalance)} />
          {instruction.tipAmount > 0 ? <Row label="ทิป" value={formatMoney(instruction.tipAmount)} /> : null}
          {instruction.tipAmount > 0 ? <Row label="ยอดโอนรวม" value={formatMoney(instruction.transferTotal)} /> : null}
        </dl>
      ) : null}

      <div className="rounded-2xl bg-paper p-4 text-sm">
        <p className="text-xs text-muted">บัญชีรับเงิน</p>
        <p className="mt-1 font-medium">{instruction.accountDisplayName ?? "ยังไม่ได้เลือกบัญชี"}</p>
        {instruction.bankName ? <p>{instruction.bankName}</p> : null}
        {instruction.accountHolderName ? <p>{instruction.accountHolderName}</p> : null}
        {instruction.accountNumberMasked ? <p>{instruction.accountNumberMasked}</p> : null}
        {instruction.promptPayId ? <p>PromptPay {instruction.promptPayId}</p> : null}
        {instruction.qrDisplayEnabled && instruction.qrImagePath ? (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={instruction.qrImagePath}
              alt="QR ที่ร้านตั้งค่า"
              className="mx-auto h-56 w-56 rounded-2xl bg-white object-contain"
            />
            <p className="mt-2 text-xs text-muted">
              QR นี้เป็นรูปที่ร้านตั้งค่า ยอดโอนดูจากตัวเลขด้านบน ร้านจะบันทึกเงินเมื่อตรวจสลิปแล้วเท่านั้น
            </p>
          </div>
        ) : null}
      </div>

      {compact ? null : <p className="text-sm font-medium">โอนแล้ว กรุณาแนบสลิป</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
