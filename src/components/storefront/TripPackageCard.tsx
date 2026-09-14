import Link from "next/link";
import {
  localizedPackageList,
  localizedPackageText,
  packageDurationLabel,
  type TripPackage,
} from "@/lib/domain/trip-package";
import type { CustomerLocale } from "@/lib/i18n/locales";

/**
 * Presentational trip package card — the single source of card layout for the
 * customer storefront and the Store Admin preview. Takes resolved strings only
 * so it can render without the customer prefs provider (admin preview).
 */
export type TripPackageCardView = {
  id: string;
  /** null = preview only (no navigation) */
  href: string | null;
  coverUrl: string | null;
  title: string;
  durationLabel: string;
  summary: string;
  passengersLabel: string;
  highlights: string[];
  /** Resolved price line — quote-first stores show the ask-for-quote label */
  priceLabel: string;
  quoteFirst: boolean;
  ctaLabel: string;
  noImageLabel: string;
};

export type PackageTranslate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export function formatPackagePrice(amount: number): string {
  return `฿${amount.toLocaleString("th-TH")}`;
}

/**
 * Price line without inventing financial truth: quote-first packages and
 * packages without a starting price both fall back to the ask-the-store label.
 */
export function packagePriceLabel(
  pkg: Pick<TripPackage, "quoteFirst" | "startingPrice">,
  t: PackageTranslate,
): { label: string; quoteFirst: boolean } {
  if (pkg.quoteFirst || pkg.startingPrice == null) {
    return { label: t("package.quoteFirst"), quoteFirst: true };
  }
  return {
    label: t("package.startingPrice", { price: formatPackagePrice(pkg.startingPrice) }),
    quoteFirst: false,
  };
}

export function packagePassengersLabel(
  pkg: Pick<TripPackage, "passengerMin" | "passengerMax">,
  t: PackageTranslate,
): string {
  return pkg.passengerMin === pkg.passengerMax
    ? t("package.passengersFixed", { n: pkg.passengerMin })
    : t("package.passengers", { min: pkg.passengerMin, max: pkg.passengerMax });
}

export function buildTripPackageCardView(
  pkg: TripPackage,
  {
    locale,
    href,
    t,
  }: { locale: CustomerLocale; href: string | null; t: PackageTranslate },
): TripPackageCardView {
  const price = packagePriceLabel(pkg, t);
  return {
    id: pkg.id,
    href,
    coverUrl: pkg.coverImageUrl ?? pkg.galleryImageUrls[0] ?? null,
    title: localizedPackageText(locale, pkg.title),
    durationLabel: packageDurationLabel(locale, pkg.days, pkg.nights),
    summary: localizedPackageText(locale, pkg.summary),
    passengersLabel: packagePassengersLabel(pkg, t),
    highlights: localizedPackageList(locale, pkg.highlights),
    priceLabel: price.label,
    quoteFirst: price.quoteFirst,
    ctaLabel: t("package.viewDetail"),
    noImageLabel: t("package.gallery"),
  };
}

export function TripPackageCard({
  view,
  width = "carousel",
}: {
  view: TripPackageCardView;
  /** carousel = fixed peek widths, block = fills its container (mobile preview) */
  width?: "carousel" | "block";
}) {
  const body = (
    <>
      <div className="relative aspect-[16/10] overflow-hidden bg-[color:var(--store-paper,#F7F4EF)]">
        {view.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-[color:var(--cx-textSecondary,#6b7280)]">
            {view.noImageLabel}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-[color:var(--cx-surface,#fff)]/92 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--cx-textPrimary,#0F1724)]">
          {view.durationLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-3 pb-2 pt-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-[color:var(--cx-textPrimary,#0F1724)]">
          {view.title}
        </p>
        <p className="line-clamp-1 text-[11px] text-[color:var(--cx-textSecondary,#6b7280)]">
          <span aria-hidden>👥 </span>
          {view.passengersLabel}
        </p>
        {view.summary ? (
          <p className="line-clamp-2 min-h-[2.25rem] text-[11px] leading-relaxed text-[color:var(--cx-textSecondary,#6b7280)]">
            {view.summary}
          </p>
        ) : null}
        {view.highlights.length ? (
          <div className="flex flex-wrap gap-1">
            {view.highlights.slice(0, 3).map((chip) => (
              <span
                key={chip}
                className="max-w-full truncate rounded-full bg-[color:var(--store-primary-soft,#E8F0EF)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );

  const shell = `flex flex-col overflow-hidden rounded-2xl bg-[color:var(--cx-surface,#fff)] shadow-sm ring-1 ring-[color:var(--cx-border,rgba(0,0,0,0.08))] ${
    width === "carousel"
      ? "w-[min(74vw,272px)] shrink-0 snap-start md:w-[236px]"
      : "w-full"
  }`;

  return (
    <article data-package-card className={shell}>
      {view.href ? (
        <Link href={view.href} className="flex min-w-0 flex-1 flex-col">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">{body}</div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 px-3 pb-3">
        <p
          className={`min-w-0 truncate text-[11px] font-semibold ${
            view.quoteFirst
              ? "text-[color:var(--cx-textSecondary,#6b7280)]"
              : "text-[color:var(--cx-textPrimary,#0F1724)]"
          }`}
        >
          {view.priceLabel}
        </p>
        {view.href ? (
          <Link
            href={view.href}
            className="shrink-0 rounded-full bg-[color:var(--store-primary-soft,#E8F0EF)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
          >
            {view.ctaLabel}
          </Link>
        ) : (
          <span className="shrink-0 rounded-full bg-[color:var(--store-primary-soft,#E8F0EF)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]">
            {view.ctaLabel}
          </span>
        )}
      </div>
    </article>
  );
}
