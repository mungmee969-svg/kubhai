"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const visible = STORE_NAV.filter((item) => !hiddenHrefs?.includes(item.href));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const drawer = open ? (
    <div
      id="store-mobile-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="เมนูร้าน"
      className="lg:hidden"
      style={{ position: "fixed", inset: 0, zIndex: 2147483000 }}
    >
      <button
        type="button"
        aria-label="ปิดเมนู"
        onClick={() => setOpen(false)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "rgba(0,22,62,.52)" }}
      />
      <aside
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "min(84vw, 320px)",
          height: "100dvh",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#fff",
          color: "#01244f",
          boxShadow: "0 20px 60px rgba(0,0,0,.28)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <p className="min-w-0 truncate text-base font-semibold text-navy-800">{businessName}</p>
          <button type="button" onClick={() => setOpen(false)} aria-label="ปิดเมนู" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-2xl leading-none text-navy-800">×</button>
        </div>

        <nav style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "12px" }}>
          {visible.map((item) => {
            const active = isActive(pathname, item.href, "exact" in item && item.exact);
            const count = badgeForHref(item.href, badges);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  minHeight: 44,
                  marginBottom: 4,
                  padding: "10px 12px",
                  borderRadius: 12,
                  color: "#01244f",
                  background: active ? "#f3ead4" : "transparent",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  textDecoration: "none",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
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
              style={{ display: "block", minHeight: 44, padding: "10px 12px", borderRadius: 12, color: "#01244f", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
            >
              ↗ หน้าร้านของฉัน
            </a>
          ) : null}
        </nav>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className="h-10 shrink-0 rounded-xl border border-line bg-white px-3 text-sm text-navy-800 lg:hidden"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="store-mobile-drawer"
      >
        เมนู
      </button>
      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}
