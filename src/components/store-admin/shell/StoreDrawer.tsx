"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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
      {open ? (
        <div
          id="store-mobile-drawer"
          className="fixed inset-0 z-[100] isolate lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="เมนูร้าน"
        >
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-navy-950/50"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 z-10 flex w-[min(84vw,20rem)] max-w-full flex-col overflow-hidden bg-white shadow-2xl"
            style={{ backgroundColor: "#ffffff" }}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-4 py-4">
              <p className="min-w-0 truncate text-sm font-semibold text-navy-800">{businessName}</p>
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-xl leading-none text-navy-800"
                onClick={() => setOpen(false)}
                aria-label="ปิดเมนู"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <StoreNavLinks
                storeSlug={storeSlug}
                badges={badges}
                hiddenHrefs={hiddenHrefs}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
