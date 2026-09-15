"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { NavBadgeCounts } from "./StoreNavLinks";
import { STORE_NAV } from "./nav";
import { storefrontPath } from "@/lib/domain/storefront-url";

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function badgeForHref(href: string, badges?: NavBadgeCounts) {
  if (!badges) return 0;
  if (href === "/store/bookings") return badges.bookings ?? 0;
  if (href === "/store/finance") return badges.finance ?? 0;
  if (href === "/store/drivers") return badges.drivers ?? 0;
  if (href === "/store/billing") return badges.billing ?? 0;
  return 0;
}

export function StoreDrawer({
  businessName,
  storeSlug,
  badges,
  hiddenHrefs,
}: {
  businessName: string;
  storeSlug?: string | null;
  badges?: NavBadgeCounts;
  hiddenHrefs?: readonly string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = STORE_NAV.filter((item) => !hiddenHrefs?.includes(item.href));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="shrink-0 lg:hidden">
      <button
        type="button"
        className="h-10 rounded-xl border border-line bg-white px-3 text-sm text-navy-800"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="store-mobile-menu"
      >
        เมนู
      </button>

      {open ? (
        <div
          id="store-mobile-menu"
          role="dialog"
          aria-label="เมนูร้าน"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-[9999] max-h-[calc(100dvh-env(safe-area-inset-top)-7rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl lg:hidden"
          style={{ color: "#01244f" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
            <p className="min-w-0 truncate text-sm font-semibold text-navy-800">{businessName}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิดเมนู"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-xl leading-none text-navy-800"
            >
              ×
            </button>
          </div>

          <nav className="max-h-[calc(100dvh-env(safe-area-inset-top)-11rem)] overflow-y-auto overscroll-contain bg-white p-2 [-webkit-overflow-scrolling:touch]">
            {visible.map((item) => {
              const active = isActive(pathname, item.href, "exact" in item && item.exact);
              const count = badgeForHref(item.href, badges);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`mb-1 flex min-h-11 w-full items-center rounded-xl px-3 py-2.5 text-sm text-navy-800 ${active ? "bg-store-soft font-semibold" : "font-medium hover:bg-paper"}`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-navy-950">{count > 99 ? "99+" : count}</span> : null}
                </Link>
              );
            })}
            {storeSlug ? (
              <a
                href={storefrontPath(storeSlug)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-800 hover:bg-paper"
              >
                ↗ หน้าร้านของฉัน
              </a>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
