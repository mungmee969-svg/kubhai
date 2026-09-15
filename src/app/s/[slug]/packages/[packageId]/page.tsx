import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RememberStoreContext } from "@/components/brand/RememberStoreContext";
import { CustomerStoreIdentityLink } from "@/components/brand/CustomerStoreIdentityLink";
import { LocationMapPreview } from "@/components/maps/LocationMapPreview";
import { BookPackageButton } from "@/components/storefront/BookPackageButton";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { PartnerCustomerNav } from "@/components/storefront/PartnerCustomerNav";
import {
  packagePassengersLabel,
  packagePriceLabel,
} from "@/components/storefront/TripPackageCard";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { allowsCustomerLocales, allowsTripPackages } from "@/lib/domain/booking-entitlements";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import {
  localizedPackageList,
  localizedPackageText,
  packageDurationLabel,
} from "@/lib/domain/trip-package";
import { readCustomerLocaleCookie, readCustomerThemeCookie } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; packageId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, packageId } = await params;
  const locale = await readCustomerLocaleCookie();
  const fallback = translate(locale, "package.detail");
  const store = await getStore().getPublicStore(slug);
  if (!store) return { title: fallback };
  const pkg = await getStore().getPublicTripPackage(store.business.id, packageId);
  if (!pkg) return { title: fallback };
  return { title: `${localizedPackageText(locale, pkg.title, fallback)} · ${store.business.name}` };
}

export default async function PartnerPackageDetailPage({ params }: Params) {
  const { slug, packageId } = await params;
  const storeApi = getStore();
  const data = await storeApi.getPublicStore(slug);
  if (!data) notFound();
  if (!allowsTripPackages(data.business.subscriptionPlan)) notFound();

  // Tenant isolation + published-only is enforced by the store adapter.
  const pkg = await storeApi.getPublicTripPackage(data.business.id, packageId);
  if (!pkg) notFound();

  const [session, locale, theme] = await Promise.all([
    getCustomerSession(),
    readCustomerLocaleCookie(),
    readCustomerThemeCookie(),
  ]);
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const brand = resolveCustomerStorefrontBranding(data.business);
  const presentation = resolveBookingPresentation({
    business: data.business,
    province: data.province,
    region: data.region,
  });

  const title = localizedPackageText(locale, pkg.title);
  const summary = localizedPackageText(locale, pkg.summary);
  const conditions = localizedPackageText(locale, pkg.conditions);
  const notes = localizedPackageText(locale, pkg.notes);
  const highlights = localizedPackageList(locale, pkg.highlights);
  const included = localizedPackageList(locale, pkg.included);
  const notIncluded = localizedPackageList(locale, pkg.notIncluded);
  const duration = packageDurationLabel(locale, pkg.days, pkg.nights);
  const passengers = packagePassengersLabel(pkg, t);
  const price = packagePriceLabel(pkg, t);
  const mappedPlace = pkg.itinerary
    .flatMap((day) => day.stops)
    .map((stop) => data.places.find((place) => place.id === stop.placeId))
    .find(
      (place) =>
        place?.latitude != null &&
        place.longitude != null,
    );
  const cover = pkg.coverImageUrl ?? pkg.galleryImageUrls[0] ?? null;
  const gallery = pkg.galleryImageUrls.filter((url, index, arr) => arr.indexOf(url) === index);
  const itinerary = [...pkg.itinerary].sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <CustomerExperienceShell
      brand={brand}
      storeSlug={slug}
      multilingual={allowsCustomerLocales(data.business.subscriptionPlan)}
      initialLocale={locale}
      initialTheme={theme}
      className="min-h-dvh bg-[color:var(--store-paper,#F7F4EF)]"
    >
      <RememberStoreContext slug={slug} />
      <header className="border-b border-black/[0.04] bg-[color:var(--store-primary,#0F3D3E)] text-white">
        <div className="mx-auto max-w-[820px] space-y-3 px-4 py-3 md:px-5">
          <CustomerStoreIdentityLink
            brand={brand}
            storeSlug={slug}
            subtitle={presentation.placeLabel}
            className="max-w-full"
            subtitleClassName="text-white/75"
          />
          <PartnerCustomerNav
            slug={slug}
            loggedIn={Boolean(session)}
            active="packages"
            showPackages
          />
        </div>
      </header>

      <div className="mx-auto max-w-[820px]">
        <div className="relative aspect-[4/3] overflow-hidden bg-[color:var(--store-primary,#0F3D3E)] sm:aspect-[21/9]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--store-primary,#0F3D3E)]">
            {duration}
          </span>
        </div>

        {gallery.length > 1 ? (
          <div className="-mt-2 flex gap-2 overflow-x-auto px-4 pb-1 pt-3 scrollbar-none md:px-5">
            {gallery.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-16 w-20 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
                loading="lazy"
              />
            ))}
          </div>
        ) : null}

        <main className="space-y-5 px-4 py-6 pb-28 md:px-5">
          <div>
            <p className="text-sm font-medium text-[color:var(--store-accent,#C4A35A)]">
              {[duration, passengers, pkg.vehicleCategoryHint]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--cx-textPrimary)]">
              {title}
            </h1>
            {summary ? (
              <p className="mt-3 text-sm leading-6 text-[color:var(--cx-textSecondary)]">
                {summary}
              </p>
            ) : null}
            <p
              className={`mt-3 text-sm font-semibold ${
                price.isQuoteFirst
                  ? "text-[color:var(--cx-textSecondary)]"
                  : "text-[color:var(--cx-textPrimary)]"
              }`}
            >
              {price.label}
            </p>
          </div>

          {highlights.length ? (
            <section className="rounded-2xl bg-[color:var(--cx-surface)] p-4 shadow-sm">
              <p className="text-xs font-medium text-[color:var(--cx-textSecondary)]">
                {t("package.highlights")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {highlights.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-[color:var(--store-primary-soft,#E8F0EF)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {itinerary.length ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[color:var(--cx-textPrimary)]">
                {t("package.itinerary")}
              </h2>
              {mappedPlace ? (
                <LocationMapPreview
                  latitude={mappedPlace.latitude}
                  longitude={mappedPlace.longitude}
                  label={mappedPlace.name}
                  notConfiguredLabel={t("maps.notConfigured")}
                  coordinatesUnavailableLabel={t("maps.coordinatesUnavailable")}
                />
              ) : null}
              {itinerary.map((day) => {
                const dayTitle = localizedPackageText(locale, day.title);
                const dayDesc = localizedPackageText(locale, day.description);
                return (
                  <article
                    key={day.dayNumber}
                    className="rounded-2xl bg-[color:var(--cx-surface)] p-4 shadow-sm"
                  >
                    <p className="text-[11px] font-semibold text-[color:var(--store-accent,#C4A35A)]">
                      {t("booking.dayN", { n: day.dayNumber })}
                      {day.stops.length
                        ? ` · ${t("package.stopsCount", { count: day.stops.length })}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--cx-textPrimary)]">
                      {dayTitle}
                    </p>
                    {dayDesc ? (
                      <p className="mt-1 text-sm leading-6 text-[color:var(--cx-textSecondary)]">
                        {dayDesc}
                      </p>
                    ) : null}
                    {day.stops.length ? (
                      <ul className="mt-2 space-y-1">
                        {day.stops.map((stop, index) => (
                          <li
                            key={`${day.dayNumber}-${index}`}
                            className="text-[12px] text-[color:var(--cx-textSecondary)]"
                          >
                            <span aria-hidden>📍 </span>
                            {stop.timeApprox ? `${stop.timeApprox} · ` : ""}
                            {localizedPackageText(locale, stop.title)}
                            {stop.note ? ` — ${stop.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ) : null}

          {included.length || notIncluded.length ? (
            <section className="grid gap-3 sm:grid-cols-2">
              {included.length ? (
                <div className="rounded-2xl bg-[color:var(--cx-surface)] p-4 shadow-sm">
                  <p className="text-xs font-medium text-[color:var(--cx-textSecondary)]">
                    {t("package.included")}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[color:var(--cx-textPrimary)]">
                    {included.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {notIncluded.length ? (
                <div className="rounded-2xl bg-[color:var(--cx-surface)] p-4 shadow-sm">
                  <p className="text-xs font-medium text-[color:var(--cx-textSecondary)]">
                    {t("package.notIncluded")}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[color:var(--cx-textSecondary)]">
                    {notIncluded.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {conditions || notes ? (
            <section className="space-y-3 rounded-2xl bg-[color:var(--cx-surface)] p-4 shadow-sm">
              {conditions ? (
                <div>
                  <p className="text-xs font-medium text-[color:var(--cx-textSecondary)]">
                    {t("package.conditions")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--cx-textPrimary)]">
                    {conditions}
                  </p>
                </div>
              ) : null}
              {notes ? (
                <div>
                  <p className="text-xs font-medium text-[color:var(--cx-textSecondary)]">
                    {t("package.notes")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--cx-textPrimary)]">
                    {notes}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          <BookPackageButton pkg={pkg} storeSlug={slug} />

          <Link
            href={`/s/${slug}/packages`}
            className="block text-center text-sm font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
          >
            {t("package.backToList")}
          </Link>
        </main>
      </div>
    </CustomerExperienceShell>
  );
}
