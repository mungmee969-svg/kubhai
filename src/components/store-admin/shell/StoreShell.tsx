"use client";

import { useEffect, useState } from "react";
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
  const [mobileSearch, setMobileSearch] = useState(false);
  const hideMobileNav = /^\/store\/bookings\/[^/]+$/.test(pathname);

  useEffect(() => {
    setDrawer(false);
    setMobileSearch(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawer]);

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/kubhai-logo.jpg" alt="" width={36} height={36} className="h-9 w-9 rounded-[22%] object-cover shadow-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy-800">{businessName}</p>
            <p className="text-[11px] text-muted">ระบบหลังบ้านร้าน</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {STORE_NAV.map((item) => {
            const active = activePath(pathname, item.href, "exact" in item && item.exact);
            return (
              <Link key={item.href} href={item.href} className={`block rounded-xl px-3 py-2.5 text-sm ${active ? "bg-navy-800 text-white" : "text-navy-800 hover:bg-paper"}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line px-4 py-4 text-xs text-muted">
          <Link href="/store/settings" className="block text-navy-800">ช่วยเหลือ</Link>
          <p className="mt-2">KubHai {APP_VERSION}</p>
          <p>Powered by KubHai</p>
          <p className="mt-2 truncate text-navy-800">{email}</p>
          <form action={logoutAction} className="mt-2"><button className="text-navy-800">ออกจากระบบ</button></form>
        </div>
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนูร้าน">
          <button type="button" aria-label="ปิดเมนู" className="absolute inset-0 bg-navy-950/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-800">{businessName}</p>
                <p className="text-[11px] text-muted">{role === "BUSINESS_STAFF" ? "พนักงานร้าน" : "เจ้าของร้าน"}</p>
              </div>
              <button type="button" onClick={() => setDrawer(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-lg text-navy-800" aria-label="ปิดเมนู">×</button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {STORE_NAV.map((item) => {
                const active = activePath(pathname, item.href, "exact" in item && item.exact);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setDrawer(false)} className={`mb-1 block rounded-xl px-3 py-3 text-sm ${active ? "bg-navy-800 font-semibold text-white" : "text-navy-800 hover:bg-paper"}`}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-line p-4 text-xs text-muted">
              <p className="truncate text-navy-800">{email}</p>
              <form action={logoutAction} className="mt-3"><button className="min-h-10 text-navy-800">ออกจากระบบ</button></form>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-2 px-3 sm:px-4 lg:px-6">
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-xl text-navy-800 lg:hidden" onClick={() => setDrawer(true)} aria-label="เปิดเมนู">☰</button>
            <div className="min-w-0 flex-1 lg:flex-none">
              <p className="truncate text-sm font-semibold text-navy-800">{businessName}</p>
              <p className="truncate text-[11px] text-muted">{role === "BUSINESS_STAFF" ? "พนักงานร้าน" : "เจ้าของร้าน"}</p>
            </div>
            <div className="hidden min-w-0 flex-1 md:block"><StoreSearch businessId={businessId} /></div>
            <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-navy-800 md:hidden" onClick={() => setMobileSearch((value) => !value)} aria-label="ค้นหา">⌕</button>
            <NotificationCenter businessId={businessId} initial={notifications} />
            <div className="hidden max-w-52 text-right text-xs text-muted xl:block"><p className="truncate text-navy-800">{email}</p></div>
          </div>
          {mobileSearch ? <div className="border-t border-line px-3 py-3 md:hidden"><StoreSearch businessId={businessId} /></div> : null}
        </header>
        <main className={`min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:pb-8 ${hideMobileNav ? "pb-28" : "pb-24"}`}>
          <div className="min-w-0 max-w-full">{children}</div>
        </main>
      </div>

      {!hideMobileNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_18px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden" aria-label="เมนูด่วน">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {MOBILE_NAV.map((item) => {
              const active = activePath(pathname, item.href, "exact" in item && item.exact);
              return <Link key={item.href} href={item.href} className={`min-w-0 rounded-xl px-1 py-2.5 text-center text-[11px] sm:text-xs ${active ? "bg-navy-800 font-semibold text-white" : "text-navy-800"}`}><span className="block truncate">{item.label}</span></Link>;
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
