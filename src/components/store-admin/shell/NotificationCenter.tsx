"use client";

import { useState } from "react";
import Link from "next/link";
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/ops";
import type { OpsNotification } from "@/lib/domain/ops";

const KIND_ICON: Record<string, string> = {
  booking: "📋",
  payment: "💳",
  driver: "🚗",
  quotation: "📝",
  saas_plan: "⚙",
  ops: "•",
};

export function NotificationCenter({
  businessId,
  initial,
}: {
  businessId: string;
  initial: OpsNotification[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OpsNotification[]>(initial);
  const unread = items.filter((item) => !item.read).length;

  async function refresh() {
    const result = await listNotificationsAction(businessId);
    if (result.ok) setItems(result.data);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  }

  async function markOne(id: string) {
    await markNotificationReadAction(businessId, id);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }

  async function markAll() {
    const ids = items.filter((item) => !item.read).map((item) => item.id);
    if (!ids.length) return;
    await markAllNotificationsReadAction(businessId, ids);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        className="relative h-10 rounded-xl border border-line bg-white px-3 text-sm text-navy-800"
      >
        แจ้งเตือน
        {unread ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-navy-950">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-navy-800">แจ้งเตือน</p>
            {unread ? (
              <button type="button" onClick={() => void markAll()} className="text-xs text-muted underline">
                อ่านทั้งหมด
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีรายการที่ต้องสนใจ</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-auto text-sm">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      setOpen(false);
                      if (!item.read) void markOne(item.id);
                    }}
                    className={`block rounded-xl px-2 py-2 hover:bg-paper ${item.read ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span aria-hidden>{KIND_ICON[item.kind ?? "ops"] ?? "•"}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium text-navy-800 ${item.read ? "" : ""}`}>
                          {item.title}
                          {!item.read ? (
                            <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                          ) : null}
                        </p>
                        <p className="text-muted">{item.body}</p>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {new Date(item.createdAt).toLocaleString("th-TH", {
                            timeZone: "Asia/Bangkok",
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
