"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setDefaultPaymentAccountAction,
  setPaymentAccountActiveAction,
  upsertPaymentAccountAction,
} from "@/lib/actions/store";
import { uploadImageAction } from "@/lib/actions/ops";
import { formatAccountLine, maskAccountNumber } from "@/lib/domain/payment-accounts";
import type { PaymentAccount, PaymentAccountType } from "@/lib/domain/types";
import { Feedback } from "@/components/store-admin/ui/Feedback";

export function PaymentAccountsPanel({
  businessId,
  accounts,
}: {
  businessId: string;
  accounts: PaymentAccount[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<PaymentAccount | "new" | null>(null);
  const [qrAccount, setQrAccount] = useState<PaymentAccount | null>(null);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMessage: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(okMessage);
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Feedback error={error} success={success} />
      <div className="grid gap-3 md:grid-cols-2">
        {accounts.map((account) => (
          <article key={account.id} className="rounded-2xl bg-paper p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-navy-800">{account.displayName}</p>
                <p className="mt-1 text-sm">{formatAccountLine(account)}</p>
                {account.promptPayId ? (
                  <p className="text-sm text-muted">PromptPay {account.promptPayId}</p>
                ) : null}
                {account.qrImagePath && account.qrDisplayEnabled ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.qrImagePath} alt="" className="mt-2 h-20 w-20 rounded-xl bg-white object-contain" />
                ) : (
                  <p className="mt-1 text-xs text-muted">ยังไม่แสดง QR</p>
                )}
                <p className="mt-1 text-xs text-muted">
                  {account.accountType} · {maskAccountNumber(account.accountNumber) ?? "ไม่มีเลขบัญชี"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {account.isDefault ? (
                  <span className="rounded-full bg-navy-800 px-2 py-1 text-xs text-white">บัญชีหลัก</span>
                ) : null}
                <span className={`rounded-full px-2 py-1 text-xs ${account.isActive ? "bg-success/15 text-success" : "bg-line text-muted"}`}>
                  {account.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="h-10 rounded-xl bg-white px-3 text-sm"
                onClick={() => setEditing(account)}
              >
                แก้ไข
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-white px-3 text-sm"
                onClick={() => setQrAccount(account)}
              >
                ตั้งค่า QR
              </button>
              {!account.isDefault && account.isActive ? (
                <button
                  type="button"
                  disabled={pending}
                  className="h-10 rounded-xl bg-white px-3 text-sm disabled:opacity-60"
                  onClick={() => run(() => setDefaultPaymentAccountAction(account.id), "ตั้งเป็นบัญชีหลักแล้ว")}
                >
                  ตั้งเป็นบัญชีหลัก
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                className="h-10 rounded-xl bg-white px-3 text-sm disabled:opacity-60"
                onClick={() =>
                  run(
                    () => setPaymentAccountActiveAction(account.id, !account.isActive),
                    account.isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว",
                  )
                }
              >
                {account.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        className="h-11 rounded-xl bg-navy-800 px-4 text-sm text-white"
        onClick={() => setEditing("new")}
      >
        เพิ่มบัญชีรับเงิน
      </button>
      {qrAccount ? (
        <QrEditor
          businessId={businessId}
          account={qrAccount}
          pending={pending}
          onClose={() => setQrAccount(null)}
          onSave={(input) => run(() => upsertPaymentAccountAction(businessId, input), "บันทึก QR แล้ว")}
        />
      ) : null}
      {editing ? (
        <AccountEditor
          businessId={businessId}
          account={editing === "new" ? null : editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSave={(input) => run(() => upsertPaymentAccountAction(businessId, input), "บันทึกบัญชีแล้ว")}
        />
      ) : null}
    </div>
  );
}

function AccountEditor({
  businessId,
  account,
  pending,
  onClose,
  onSave,
}: {
  businessId: string;
  account: PaymentAccount | null;
  pending: boolean;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    displayName: string;
    accountType: PaymentAccountType;
    bankCode: string | null;
    bankName: string | null;
    accountHolderName: string | null;
    accountNumber: string | null;
    promptPayId: string | null;
    qrImagePath: string | null;
    qrDisplayEnabled?: boolean;
    isDefault: boolean;
  }) => void;
}) {
  const [displayName, setDisplayName] = useState(account?.displayName ?? "");
  const [accountType, setAccountType] = useState<PaymentAccountType>(account?.accountType ?? "BANK_ACCOUNT");
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [bankCode, setBankCode] = useState(account?.bankCode ?? "");
  const [accountHolderName, setAccountHolderName] = useState(account?.accountHolderName ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [promptPayId, setPromptPayId] = useState(account?.promptPayId ?? "");
  const [qrImagePath, setQrImagePath] = useState(account?.qrImagePath ?? "");
  const [isDefault, setIsDefault] = useState(account?.isDefault ?? false);

  async function uploadQr(file: File) {
    const data = new FormData();
    data.set("file", file);
    data.set("businessId", businessId);
    const result = await uploadImageAction(data);
    if (result.ok && result.data) setQrImagePath(result.data.url);
  }

  return (
    <div className="space-y-3 rounded-2xl bg-paper p-4">
      <h3 className="font-semibold text-navy-800">{account ? "แก้ไขบัญชี" : "บัญชีใหม่"}</h3>
      <input className="admin-input" placeholder="ชื่อบัญชีในระบบ" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <select className="admin-input" value={accountType} onChange={(e) => setAccountType(e.target.value as PaymentAccountType)}>
        <option value="BANK_ACCOUNT">BANK_ACCOUNT</option>
        <option value="PROMPTPAY">PROMPTPAY</option>
        <option value="OTHER">OTHER</option>
      </select>
      <input className="admin-input" placeholder="ธนาคาร" value={bankName} onChange={(e) => setBankName(e.target.value)} />
      <input className="admin-input" placeholder="รหัสธนาคาร" value={bankCode} onChange={(e) => setBankCode(e.target.value)} />
      <input className="admin-input" placeholder="ชื่อบัญชี" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
      <input className="admin-input" placeholder="เลขบัญชี" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
      <input className="admin-input" placeholder="PromptPay" value={promptPayId} onChange={(e) => setPromptPayId(e.target.value)} />
      <label className="block text-sm text-muted">
        QR รับเงิน (ถ้ามี)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadQr(file);
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        ตั้งเป็นบัญชีรับเงินหลัก
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60"
          onClick={() =>
            onSave({
              id: account?.id,
              displayName,
              accountType,
              bankCode: bankCode || null,
              bankName: bankName || null,
              accountHolderName: accountHolderName || null,
              accountNumber: accountNumber || null,
              promptPayId: promptPayId || null,
              qrImagePath: qrImagePath || null,
              qrDisplayEnabled: Boolean(qrImagePath),
              isDefault,
            })
          }
        >
          บันทึกบัญชี
        </button>
        <button type="button" className="h-11 rounded-xl bg-white px-4 text-sm" onClick={onClose}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

function QrEditor({
  businessId,
  account,
  pending,
  onClose,
  onSave,
}: {
  businessId: string;
  account: PaymentAccount;
  pending: boolean;
  onClose: () => void;
  onSave: (input: {
    id: string;
    displayName: string;
    accountType: PaymentAccountType;
    bankCode: string | null;
    bankName: string | null;
    accountHolderName: string | null;
    accountNumber: string | null;
    promptPayId: string | null;
    qrImagePath: string | null;
    qrDisplayEnabled: boolean;
    isDefault: boolean;
  }) => void;
}) {
  const [promptPayId, setPromptPayId] = useState(account.promptPayId ?? "");
  const [qrImagePath, setQrImagePath] = useState(account.qrImagePath ?? "");
  const [qrDisplayEnabled, setQrDisplayEnabled] = useState(account.qrDisplayEnabled);

  async function uploadQr(file: File) {
    const data = new FormData();
    data.set("file", file);
    data.set("businessId", businessId);
    const result = await uploadImageAction(data);
    if (result.ok && result.data) {
      setQrImagePath(result.data.url);
      setQrDisplayEnabled(true);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-paper p-4">
      <h3 className="font-semibold text-navy-800">ตั้งค่า QR · {account.displayName}</h3>
      <p className="text-sm text-muted">
        อัปโหลดรูป QR จริงของร้านเท่านั้น ไม่สร้าง QR ธนาคารให้อัตโนมัติ
      </p>
      <input className="admin-input" placeholder="PromptPay ID" value={promptPayId} onChange={(e) => setPromptPayId(e.target.value)} />
      {qrImagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrImagePath} alt="พรีวิว QR" className="h-56 w-56 rounded-2xl bg-white object-contain" />
      ) : (
        <p className="text-sm text-muted">ยังไม่มีรูป QR</p>
      )}
      <label className="block text-sm text-muted">
        อัปโหลด / แทนที่ QR
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadQr(file);
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={qrDisplayEnabled} onChange={(e) => setQrDisplayEnabled(e.target.checked)} />
        แสดง QR ให้ลูกค้า
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60"
          onClick={() =>
            onSave({
              id: account.id,
              displayName: account.displayName,
              accountType: account.accountType,
              bankCode: account.bankCode,
              bankName: account.bankName,
              accountHolderName: account.accountHolderName,
              accountNumber: account.accountNumber,
              promptPayId: promptPayId || null,
              qrImagePath: qrImagePath || null,
              qrDisplayEnabled,
              isDefault: account.isDefault,
            })
          }
        >
          บันทึก QR
        </button>
        <button
          type="button"
          disabled={pending || !qrImagePath}
          className="h-11 rounded-xl bg-white px-4 text-sm disabled:opacity-60"
          onClick={() => {
            setQrImagePath("");
            setQrDisplayEnabled(false);
          }}
        >
          ลบรูป QR
        </button>
        <button type="button" className="h-11 rounded-xl bg-white px-4 text-sm" onClick={onClose}>
          ปิด
        </button>
      </div>
    </div>
  );
}
