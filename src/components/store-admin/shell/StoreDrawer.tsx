"use client";

import { useState } from "react";
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
  return (
    <>
      <button
        type="button"
        className="h-10 rounded-xl border border-line px-3 text-sm lg:hidden"
        onClick={() => setOpen(true)}
      >
        เมนู
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-navy-950/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white py-4 shadow-xl">
            <p className="mb-3 px-4 text-sm font-semibold text-navy-800">{businessName}</p>
            <StoreNavLinks
              storeSlug={storeSlug}
              badges={badges}
              hiddenHrefs={hiddenHrefs}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
