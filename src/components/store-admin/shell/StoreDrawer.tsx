"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StoreNavLinks, type NavBadgeCounts } from "./StoreNavLinks";

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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

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
      className="fixed inset-0 z-[9999] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="เมนูร้าน"
    >
      <button
        type="button"
        aria-label="ปิดเมนู"
        className="absolute inset-0 h-full w-full bg-navy-950/50"
        onClick={() => setOpen(false)}
      />
      <aside className="absolute inset-y-0 left-0 z-10 flex h-dvh w-[84vw] max-w-[20rem] flex-col bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <p className="min-w-0 truncate text-base font-semibold text-navy-800">{businessName}</p>
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-2xl leading-none text-navy-800"
            onClick={() => setOpen(false)}
            aria-label="ปิดเมนู"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-navy-800">
          <StoreNavLinks
            storeSlug={storeSlug}
            badges={badges}
            hiddenHrefs={hiddenHrefs}
            onNavigate={() => setOpen(false)}
          />
        </div>
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
