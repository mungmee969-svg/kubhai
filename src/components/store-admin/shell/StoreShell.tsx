"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import type { OpsNotification } from "@/lib/domain/ops";
import { APP_VERSION, MOBILE_NAV, STORE_NAV } from "./nav";
import { NotificationCenter } from "./NotificationCenter";
import { StoreSearch } from "./StoreSearch";

function activePath(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function StoreShell({
  businessId,
  businessName,
  email,
  role,
  notifications,
  children,
}: {
  businessId: string;
  businessName: string;
  email: string;
  role: string;
  notifications: OpsNotification[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const hideMobileNav = /^\/store\/bookings\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-dvh bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          {/* plain img avoids next/image hydration mismatch in this client shell */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/kubhai-logo.jpg"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-[22%] object-cover shadow-sm"
          />
          <div>
            <p className="text-sm font-semibold text-navy-800">KubHai Store</p>
            <p className="text-[11px] text-muted">งานร้านรายวัน</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {STORE_NAV.map((item) => {
            const active = activePath(pathname, item.href, "exact" in item && item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-3 py-2.5 text-sm ${
                  active ? "bg-navy-800 text-white" : "text-navy-800 hover:bg-paper"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line px-4 py-4 text-xs text-muted">
          <Link href="/store/settings" className="block text-navy-800">
            ช่วยเหลือ
          </Link>
          <p className="mt-2">KubHai {APP_VERSION}</p>
          <p>Powered by KubHai</p>
          <p className="mt-2 truncate text-navy-800">{email}</p>
          <form action={logoutAction} className="mt-2">
            <button className="text-navy-800">ออกจากระบบ</button>
          </form>
        </div>
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-navy-950/30" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white p-4 shadow-xl">
            <p className="mb-3 text-sm font-semibold text-navy-800">{businessName}</p>
            {STORE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawer(false)}
                className="block rounded-xl px-3 py-2.5 text-sm text-navy-800 hover:bg-paper"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="h-10 rounded-xl border border-line px-3 text-sm lg:hidden"
              onClick={() => setDrawer(true)}
            >
              เมนู
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy-800">{businessName}</p>
              <p className="text-[11px] text-muted">
                {role === "BUSINESS_STAFF" ? "พนักงานร้าน" : "เจ้าของร้าน"}
              </p>
            </div>
            <StoreSearch businessId={businessId} />
            <NotificationCenter businessId={businessId} initial={notifications} />
            <div className="hidden text-right text-xs text-muted md:block">
              <p className="truncate text-navy-800">{email}</p>
            </div>
          </div>
        </header>
        <main className={`px-4 py-6 lg:px-8 lg:pb-8 ${hideMobileNav ? "pb-28" : "pb-24"}`}>
          {children}
        </main>
      </div>

      {!hideMobileNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white px-2 py-2 lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {MOBILE_NAV.map((item) => {
              const active = activePath(pathname, item.href, "exact" in item && item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl py-2 text-center text-xs ${
                    active ? "bg-navy-800 text-white" : "text-navy-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
