"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  TripPackageCard,
  buildTripPackageCardView,
} from "@/components/storefront/TripPackageCard";
import { sortFeaturedPackages, type TripPackage } from "@/lib/domain/trip-package";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";

const PREVIEW_LIMIT = 8;

/**
 * "แพ็กเกจทริปแนะนำ" — horizontal carousel that always leaves a peek of the next
 * card on mobile and shows 3+ cards on desktop. Never a Quick Booking card:
 * the CTA leads to the package detail page, which starts the normal wizard.
 */
export function FeaturedTripPackages({
  packages,
  storeSlug,
  mode = "preview",
}: {
  packages: TripPackage[];
  storeSlug: string;
  mode?: "preview" | "full";
}) {
  const { t, locale } = useCustomerPrefs();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const visible = useMemo(() => {
    const sorted = sortFeaturedPackages(packages);
    return mode === "preview" ? sorted.slice(0, PREVIEW_LIMIT) : sorted;
  }, [packages, mode]);

  function updateScrollState() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < max - 8);
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollState) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro?.disconnect();
    };
  }, [visible.length]);

  if (!visible.length) {
    if (mode === "preview") return null;
    return (
      <section id="packages" className="space-y-3 scroll-mt-20">
        <h2 className="text-base font-semibold tracking-tight text-[color:var(--cx-textPrimary)] md:text-lg">
          {t("package.sectionTitle")}
        </h2>
        <p className="rounded-2xl bg-[color:var(--cx-surface)] px-4 py-4 text-sm text-[color:var(--cx-textSecondary)] shadow-sm ring-1 ring-[color:var(--cx-border)]">
          {t("package.empty")} — {t("package.emptyHint")}
        </p>
      </section>
    );
  }

  function scrollByCards(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-package-card]");
    const step = card ? (card.offsetWidth + 12) * dir : dir * el.clientWidth * 0.75;
    el.scrollBy({ left: step, behavior: "smooth" });
  }

  return (
    <section id="packages" className="space-y-3 scroll-mt-20">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[color:var(--cx-textPrimary)] md:text-lg">
            {t("package.sectionTitle")}
          </h2>
          <p className="truncate text-xs text-[color:var(--cx-textSecondary)] sm:text-sm">
            {t("package.sectionSubtitle")}
          </p>
        </div>
        {mode === "preview" ? (
          <Link
            href={`/s/${storeSlug}/packages`}
            className="shrink-0 text-sm font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
          >
            {t("package.viewAll")} →
          </Link>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label={t("travel.scrollPrev")}
          onClick={() => scrollByCards(-1)}
          disabled={!canPrev}
          className="absolute -left-1 top-[42%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--cx-surface)] text-lg text-[color:var(--cx-textPrimary)] shadow-md ring-1 ring-[color:var(--cx-border)] disabled:opacity-30 md:flex"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label={t("travel.scrollNext")}
          onClick={() => scrollByCards(1)}
          disabled={!canNext}
          className="absolute -right-1 top-[42%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--cx-surface)] text-lg text-[color:var(--cx-textPrimary)] shadow-md ring-1 ring-[color:var(--cx-border)] disabled:opacity-30 md:flex"
        >
          ›
        </button>

        <div
          ref={scrollerRef}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-1"
        >
          {visible.map((pkg) => (
            <TripPackageCard
              key={pkg.id}
              view={buildTripPackageCardView(pkg, {
                locale,
                href: `/s/${storeSlug}/packages/${pkg.id}`,
                t,
              })}
            />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-[color:var(--cx-textSecondary)]">{t("package.quoteHint")}</p>
    </section>
  );
}
