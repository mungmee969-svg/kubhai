"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approvePaymentProofAction,
  rejectPaymentProofAction,
  setBookingReceivingAccountAction,
  updateProofAllocationAction,
} from "@/lib/actions/store";
import {
  formatAccountLine,
  INTENT_LABEL,
  REJECT_REASONS,
  REVIEW_LABEL,
} from "@/lib/domain/payment-accounts";
import { formatMoney, formatThaiDateTime } from "@/lib/domain/ops";
import { money } from "@/lib/domain/settlement";
import type { MoneyAllocation, PaymentAccount, PaymentProof } from "@/lib/domain/types";

export function ReceivingAccountCard({
  bookingId,
  account,
  accounts,
}: {
  bookingId: string;
  account: PaymentAccount | null;
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(account?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-paper px-3 py-3">
      <p className="text-xs text-muted">บัญชีรับเงินที่เลือก</p>
      <p className="mt-1 font-medium">{account?.displayName ?? "ใช้บัญชีหลักร้าน"}</p>
      <p className="text-sm text-muted">{formatAccountLine(account)}</p>
      <button type="button" className="mt-2 h-10 rounded-xl bg-white px-3 text-sm" onClick={() => setOpen((value) => !value)}>
        เปลี่ยนบัญชีรับเงิน
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          <select className="admin-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">เลือกบัญชี</option>
            {accounts.filter((item) => item.isActive).map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName} · {item.bankName}
              </option>
            ))}
          </select>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="button"
            disabled={pending || !accountId}
            className="h-10 rounded-xl bg-navy-800 px-3 text-sm text-white disabled:opacity-60"
            onClick={async () => {
              setPending(true);
              setError(null);
              const result = await setBookingReceivingAccountAction(bookingId, accountId);
              setPending(false);
              if (!result.ok) setError(result.error);
              else {
                setOpen(false);
                router.refresh();
              }
            }}
          >
            บันทึกบัญชีงานนี้
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProofHistory({
  proofs,
  onReview,
}: {
  proofs: PaymentProof[];
  onReview: (proof: PaymentProof) => void;
}) {
  if (!proofs.length) {
    return <p className="mt-3 text-sm text-muted">ยังไม่มีสลิปจากลูกค้า</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {proofs.map((proof) => (
        <li key={proof.id} className="rounded-xl bg-paper px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {INTENT_LABEL[proof.paymentIntent]} {formatMoney(proof.claimedAmount)}
              </p>
              <p className="text-xs text-muted">
                {REVIEW_LABEL[proof.reviewStatus]}
                {proof.rejectReason ? ` — ${proof.rejectReason}` : ""} · {formatThaiDateTime(proof.submittedAt)}
              </p>
              <p className="text-xs text-muted">{formatAccountLine(proof.receivingAccountSnapshot)}</p>
            </div>
            <button type="button" className="h-10 rounded-xl bg-white px-3 text-sm" onClick={() => onReview(proof)}>
              {proof.reviewStatus === "PENDING_REVIEW" ? "ตรวจสอบ" : "ดูสลิป"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SlipReviewDrawer({
  proof,
  expectedAmount,
  onClose,
  onDone,
}: {
  proof: PaymentProof;
  expectedAmount: number | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [service, setService] = useState(String(amountOf(proof.allocations, "SERVICE_BALANCE") || ""));
  const [deposit, setDeposit] = useState(String(amountOf(proof.allocations, "DEPOSIT") || ""));
  const [tip, setTip] = useState(String(amountOf(proof.allocations, "TIP_RECEIVED") || ""));
  const [reason, setReason] = useState<(typeof REJECT_REASONS)[number]>("ยอดไม่ตรง");
  const [note, setNote] = useState(proof.adminNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allocated = money(Number(deposit || 0)) + money(Number(service || 0)) + money(Number(tip || 0));
  const canEdit = proof.reviewStatus === "PENDING_REVIEW";

  function currentAllocations(): MoneyAllocation[] {
    const allocations: MoneyAllocation[] = [];
    if (money(Number(deposit || 0)) > 0) allocations.push({ kind: "DEPOSIT", amount: money(Number(deposit)) });
    if (money(Number(service || 0)) > 0) allocations.push({ kind: "SERVICE_BALANCE", amount: money(Number(service)) });
    if (money(Number(tip || 0)) > 0) allocations.push({ kind: "TIP_RECEIVED", amount: money(Number(tip)) });
    return allocations;
  }

  async function saveAllocation() {
    setPending(true);
    setError(null);
    const result = await updateProofAllocationAction(proof.bookingId, proof.id, currentAllocations());
    setPending(false);
    if (!result.ok) setError(result.error);
    else onDone("แก้การแบ่งยอดแล้ว");
  }

  async function approve() {
    if (!window.confirm("อนุมัติสลิปนี้และบันทึกเป็นเงินรับจริง?")) return;
    setPending(true);
    setError(null);
    const result = await approvePaymentProofAction(proof.bookingId, proof.id, {
      allocations: currentAllocations(),
      adminNote: note || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone("อนุมัติสลิปแล้ว");
    onClose();
  }

  async function reject() {
    setPending(true);
    setError(null);
    const result = await rejectPaymentProofAction(proof.bookingId, proof.id, {
      reason,
      adminNote: note || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone("ปฏิเสธสลิปแล้ว");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-navy-950/35" onClick={onClose} />
      <aside className="kh-drawer absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy-800">ตรวจสอบสลิป</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            ปิด
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/store/slips/${proof.slipFileId}`}
            alt="สลิปโอนเงิน"
            className="max-h-[50vh] w-full rounded-2xl bg-paper object-contain"
          />
          <p className="text-sm font-semibold">{REVIEW_LABEL[proof.reviewStatus]} · {INTENT_LABEL[proof.paymentIntent]}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-paper px-3 py-2">
              <dt className="text-xs text-muted">ยอดที่ระบบคาด</dt>
              <dd className="font-medium">{formatMoney(expectedAmount)}</dd>
            </div>
            <div className="rounded-xl bg-paper px-3 py-2">
              <dt className="text-xs text-muted">ยอดที่ลูกค้าแจ้ง</dt>
              <dd className="font-medium">{formatMoney(proof.claimedAmount)}</dd>
            </div>
          </dl>
          <div className="rounded-xl bg-paper px-3 py-2 text-sm">
            <p className="text-xs text-muted">แบ่งเป็น</p>
            <p>ค่าบริการ {formatMoney(amountOf(proof.allocations, "SERVICE_BALANCE") + amountOf(proof.allocations, "DEPOSIT"))}</p>
            <p>ทิป {formatMoney(amountOf(proof.allocations, "TIP_RECEIVED"))}</p>
          </div>
          <p className="text-sm">{proof.receivingAccountSnapshot ? formatAccountLine(proof.receivingAccountSnapshot) : "ไม่พบข้อมูลบัญชีเดิม"}</p>
          <p className="text-xs text-muted">{formatThaiDateTime(proof.submittedAt)}</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm">
              มัดจำ
              <input className="admin-input mt-1" disabled={!canEdit} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </label>
            <label className="text-sm">
              ค่าบริการ
              <input className="admin-input mt-1" disabled={!canEdit} value={service} onChange={(e) => setService(e.target.value)} />
            </label>
            <label className="text-sm">
              ทิป
              <input className="admin-input mt-1" disabled={!canEdit} value={tip} onChange={(e) => setTip(e.target.value)} />
            </label>
          </div>
          <p className={`text-sm ${allocated === proof.claimedAmount ? "text-muted" : "text-danger"}`}>
            แบ่งแล้ว {formatMoney(allocated)} จากยอดโอน {formatMoney(proof.claimedAmount)}
          </p>
          {canEdit ? (
            <button type="button" disabled={pending} className="h-10 rounded-xl bg-paper text-sm disabled:opacity-60" onClick={() => void saveAllocation()}>
              แก้ไขการแบ่งยอด
            </button>
          ) : null}
          <label className="text-sm">
            เหตุผลปฏิเสธ
            <select className="admin-input mt-1" disabled={!canEdit} value={reason} onChange={(e) => setReason(e.target.value as (typeof REJECT_REASONS)[number])}>
              {REJECT_REASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            โน้ตร้าน
            <input className="admin-input mt-1" disabled={!canEdit} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {canEdit ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending || allocated !== proof.claimedAmount}
                className="h-11 rounded-xl bg-accent text-sm font-semibold text-navy-950 disabled:opacity-60"
                onClick={() => void approve()}
              >
                {pending ? "กำลังบันทึก..." : "อนุมัติ"}
              </button>
              <button
                type="button"
                disabled={pending}
                className="h-11 rounded-xl bg-paper text-sm disabled:opacity-60"
                onClick={() => void reject()}
              >
                ปฏิเสธ
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function amountOf(allocations: MoneyAllocation[], kind: MoneyAllocation["kind"]) {
  return allocations.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.amount, 0);
}
