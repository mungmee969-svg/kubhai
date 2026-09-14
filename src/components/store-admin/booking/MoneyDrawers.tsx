"use client";

import { useMemo, useState } from "react";
import { recordMoneyMovementAction } from "@/lib/actions/store";
import { formatMoney } from "@/lib/domain/ops";
import { money } from "@/lib/domain/settlement";
import { formatAccountLine } from "@/lib/domain/payment-accounts";
import type { Driver, PaymentAccount } from "@/lib/domain/types";
import type { MoneyAllocationKind, MoneyPayeeKind } from "@/lib/domain/types";

function nowLocal() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReceiveMoneyDrawer({
  bookingId,
  defaultDeposit,
  defaultService,
  defaultTip,
  accounts,
  defaultAccountId,
  onClose,
  onDone,
}: {
  bookingId: string;
  defaultDeposit: number;
  defaultService: number;
  defaultTip: number;
  accounts: PaymentAccount[];
  defaultAccountId: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [transfer, setTransfer] = useState(String(defaultDeposit + defaultService + defaultTip || ""));
  const [deposit, setDeposit] = useState(String(defaultDeposit || ""));
  const [service, setService] = useState(String(defaultService || ""));
  const [tip, setTip] = useState(String(defaultTip || ""));
  const [occurredAt, setOccurredAt] = useState(nowLocal());
  const [method, setMethod] = useState("โอน");
  const [reference, setReference] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allocated = money(Number(deposit || 0)) + money(Number(service || 0)) + money(Number(tip || 0));
  const actual = money(Number(transfer || 0));

  async function save() {
    setPending(true);
    setError(null);
    const allocations: { kind: MoneyAllocationKind; amount: number }[] = [];
    if (money(Number(deposit || 0)) > 0) allocations.push({ kind: "DEPOSIT", amount: money(Number(deposit)) });
    if (money(Number(service || 0)) > 0) allocations.push({ kind: "SERVICE_BALANCE", amount: money(Number(service)) });
    if (money(Number(tip || 0)) > 0) allocations.push({ kind: "TIP_RECEIVED", amount: money(Number(tip)) });
    const result = await recordMoneyMovementAction(bookingId, {
      direction: "IN",
      transferAmount: actual,
      allocations,
      method,
      reference,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      receivingAccountId: accountId || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone("บันทึกรับเงินแล้ว");
    onClose();
  }

  return (
    <Drawer title="บันทึกรับเงิน" onClose={onClose}>
      <label className="text-sm">
        ยอดที่โอนจริง
        <input className="admin-input mt-1" inputMode="numeric" value={transfer} onChange={(e) => setTransfer(e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm">
          มัดจำ
          <input className="admin-input mt-1" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </label>
        <label className="text-sm">
          ค่าบริการ
          <input className="admin-input mt-1" inputMode="numeric" value={service} onChange={(e) => setService(e.target.value)} />
        </label>
        <label className="text-sm">
          ทิป
          <input className="admin-input mt-1" inputMode="numeric" value={tip} onChange={(e) => setTip(e.target.value)} />
        </label>
      </div>
      <p className={`text-sm ${allocated === actual ? "text-muted" : "text-danger"}`}>
        แบ่งแล้ว {formatMoney(allocated)} จากยอดโอน {formatMoney(actual || null)}
      </p>
      <label className="text-sm">
        วันที่/เวลา
        <input className="admin-input mt-1" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
      </label>
      <label className="text-sm">
        บัญชีรับเงิน
        <select className="admin-input mt-1" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">เลือกบัญชี</option>
          {accounts.filter((item) => item.isActive).map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName} · {formatAccountLine(item)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        ช่องทาง
        <input className="admin-input mt-1" value={method} onChange={(e) => setMethod(e.target.value)} />
      </label>
      <label className="text-sm">
        อ้างอิง / หมายเหตุ
        <input className="admin-input mt-1" value={reference} onChange={(e) => setReference(e.target.value)} />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        disabled={pending || allocated !== actual || actual <= 0}
        onClick={() => void save()}
        className="h-11 rounded-xl bg-accent text-sm font-semibold text-navy-950 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก..." : "บันทึกรับเงิน"}
      </button>
    </Drawer>
  );
}

export function PayoutDrawer({
  bookingId,
  defaultFee,
  defaultTip,
  drivers,
  defaultPayee,
  accounts,
  defaultAccountId,
  onClose,
  onDone,
}: {
  bookingId: string;
  defaultFee: number;
  defaultTip: number;
  drivers: Driver[];
  defaultPayee?: Driver;
  accounts: PaymentAccount[];
  defaultAccountId: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [transfer, setTransfer] = useState(String(defaultFee + defaultTip || ""));
  const [fee, setFee] = useState(String(defaultFee || ""));
  const [tip, setTip] = useState(String(defaultTip || ""));
  const [payeeKind, setPayeeKind] = useState<MoneyPayeeKind>(
    defaultPayee?.driverType === "PARTNER" ? "PARTNER" : "DRIVER",
  );
  const [payeeId, setPayeeId] = useState(defaultPayee?.id ?? "");
  const [occurredAt, setOccurredAt] = useState(nowLocal());
  const [method, setMethod] = useState("โอน");
  const [reference, setReference] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payee = useMemo(() => drivers.find((item) => item.id === payeeId), [drivers, payeeId]);
  const allocated = money(Number(fee || 0)) + money(Number(tip || 0));
  const actual = money(Number(transfer || 0));

  async function save() {
    setPending(true);
    setError(null);
    const payoutKind: MoneyAllocationKind = payeeKind === "PARTNER" ? "PARTNER_PAYOUT" : "DRIVER_PAYOUT";
    const allocations: { kind: MoneyAllocationKind; amount: number }[] = [];
    if (money(Number(fee || 0)) > 0) allocations.push({ kind: payoutKind, amount: money(Number(fee)) });
    if (money(Number(tip || 0)) > 0) allocations.push({ kind: "TIP_PAYOUT", amount: money(Number(tip)) });
    const result = await recordMoneyMovementAction(bookingId, {
      direction: "OUT",
      transferAmount: actual,
      allocations,
      method,
      reference,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      payeeKind,
      payeeId: payee?.id ?? null,
      payeeName: payee?.name ?? (payeeKind === "TEAM" ? "ทีมร้าน" : null),
      sourceAccountId: accountId || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone("บันทึกการโอนแล้ว");
    onClose();
  }

  return (
    <Drawer title="บันทึกการโอนค่าตัว" onClose={onClose}>
      <label className="text-sm">
        ประเภทผู้รับ
        <select className="admin-input mt-1" value={payeeKind} onChange={(e) => setPayeeKind(e.target.value as MoneyPayeeKind)}>
          <option value="DRIVER">DRIVER คนขับร้าน</option>
          <option value="PARTNER">PARTNER คนขับทีม</option>
          <option value="TEAM">TEAM ทีมร้าน</option>
        </select>
      </label>
      <label className="text-sm">
        ผู้รับ
        <select className="admin-input mt-1" value={payeeId} onChange={(e) => setPayeeId(e.target.value)}>
          <option value="">เลือกคนขับ</option>
          {drivers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        ยอดโอนรวม
        <input className="admin-input mt-1" inputMode="numeric" value={transfer} onChange={(e) => setTransfer(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          ค่าตัว
          <input className="admin-input mt-1" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label className="text-sm">
          ทิปส่งต่อ
          <input className="admin-input mt-1" inputMode="numeric" value={tip} onChange={(e) => setTip(e.target.value)} />
        </label>
      </div>
      <p className={`text-sm ${allocated === actual ? "text-muted" : "text-danger"}`}>
        แบ่งแล้ว {formatMoney(allocated)} จากยอดโอน {formatMoney(actual || null)}
      </p>
      <label className="text-sm">
        วันที่/เวลา
        <input className="admin-input mt-1" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
      </label>
      <label className="text-sm">
        จ่ายจากบัญชี
        <select className="admin-input mt-1" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">เลือกบัญชี</option>
          {accounts.filter((item) => item.isActive).map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName} · {formatAccountLine(item)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        ช่องทาง
        <input className="admin-input mt-1" value={method} onChange={(e) => setMethod(e.target.value)} />
      </label>
      <label className="text-sm">
        อ้างอิง / หมายเหตุ
        <input className="admin-input mt-1" value={reference} onChange={(e) => setReference(e.target.value)} />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        disabled={pending || allocated !== actual || actual <= 0}
        onClick={() => void save()}
        className="h-11 rounded-xl bg-accent text-sm font-semibold text-navy-950 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก..." : "บันทึกการโอน"}
      </button>
    </Drawer>
  );
}

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-navy-950/35" onClick={onClose} />
      <aside className="kh-drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy-800">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            ปิด
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
