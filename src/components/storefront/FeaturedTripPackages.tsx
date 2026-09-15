"use client";

import Link from "next/link";
import { useMemo } from "react";
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

  const visible = useMemo(() => {
    const sorted = sortFeaturedPackages(packages);
    return mode === "preview" ? sorted.slice(0, PREVIEW_LIMIT) : sorted;
  }, [packages, mode]);

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

  return (
    <section id="packages" className="scroll-mt-20 space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 text-base font-semibold tracking-tight text-[color:var(--cx-textPrimary)] md:text-lg">
            {t("package.sectionTitle")}
          </h2>
          {mode === "preview" && visible.length > 1 ? (
          <Link
            href={`/s/${storeSlug}/packages`}
              className="shrink-0 text-xs font-semibold leading-5 text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))] sm:text-sm"
          >
            {t("package.viewAll")} →
          </Link>
        ) : null}
        </div>
        <p className="text-xs leading-5 text-[color:var(--cx-textSecondary)] sm:text-sm">
          {t("package.sectionSubtitle")}
        </p>
      </div>

      <div
        data-package-layout={visible.length === 1 ? "single" : visible.length === 2 ? "pair" : "many"}
        className={
          visible.length === 1
            ? "mx-auto w-full max-w-[560px]"
            : visible.length === 2
              ? "grid gap-3 sm:grid-cols-2"
              : "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0"
        }
      >
          {visible.map((pkg) => (
            <TripPackageCard
              key={pkg.id}
              view={buildTripPackageCardView(pkg, {
                locale,
                href: `/s/${storeSlug}/packages/${pkg.id}`,
                t,
              })}
              width={
                visible.length === 1
                  ? "single"
                  : visible.length === 2
                    ? "block"
                    : "responsive"
              }
            />
          ))}
      </div>
    </section>
  );
}
