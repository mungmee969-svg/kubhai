import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RememberStoreContext } from "@/components/brand/RememberStoreContext";
import { StoreLogo } from "@/components/brand/StoreBrand";
import { AddToTripButton } from "@/components/discovery/AddToTripButton";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { PartnerCustomerNav } from "@/components/storefront/PartnerCustomerNav";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import { allowsCustomerLocales } from "@/lib/domain/booking-entitlements";
import { publicTripPackagesFor } from "@/lib/data/public-trip-packages";
import type { PlaceCategory } from "@/lib/domain/enums";
import {
  travelPlaceCoverUrl,
  travelPlaceShortText,
} from "@/lib/domain/travel-recommendations";
import { isValidPlaceImageUrl } from "@/lib/domain/place-image";
import { readCustomerLocaleCookie, serverT } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

const PLACE_CATEGORY_KEYS: Record<PlaceCategory, string> = {
  ATTRACTION: "travel.popular",
  RESTAURANT: "travel.restaurant",
  LOCAL_FOOD: "travel.localFood",
  CAFE: "travel.cafe",
  HOTEL: "travel.hotel",
  ACTIVITY: "travel.activity",
  SOUVENIR: "travel.souvenir",
  RELAXATION: "place.category.relaxation",
  SPA: "place.category.spa",
  SHOPPING: "place.category.shopping",
  OTHER: "place.category.other",
};

type Params = { params: Promise<{ slug: string; placeSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { placeSlug } = await params;
  const locale = await readCustomerLocaleCookie();
  const row = await getStore().getPublicPlaceBySlug(placeSlug);
  if (!row) return { title: translate(locale, "place.detail") };
  return { title: row.place.name };
}

export default async function PartnerTravelPlacePage({ params }: Params) {
  const { slug, placeSlug } = await params;
  const storeApi = getStore();
  const data = await storeApi.getPublicStore(slug);
  if (!data) notFound();
  const row = await storeApi.getPublicPlaceBySlug(placeSlug);
  if (!row || row.place.status !== "ACTIVE") notFound();

  // Province isolation: place must match partner province
  if (
    data.business.provinceId &&
    row.place.provinceId &&
    data.business.provinceId !== row.place.provinceId
  ) {
    notFound();
  }

  const session = await getCustomerSession();
  const brand = resolveCustomerStorefrontBranding(data.business);
  const multilingual = allowsCustomerLocales(data.business.subscriptionPlan);
  const hasPackages = (await publicTripPackagesFor(data.business)).length > 0;
  const presentation = resolveBookingPresentation({
    business: data.business,
    province: data.province,
    region: data.region,
  });
  const { place, province } = row;
  const cover = travelPlaceCoverUrl(place);
  const short = travelPlaceShortText(place);
  const gallery = [
    place.coverImageUrl,
    ...place.imageUrls,
  ].filter((url, index, arr): url is string => Boolean(url) && isValidPlaceImageUrl(url) && arr.indexOf(url) === index);

  const [
    navTravel,
    categoryLabel,
    addressLabel,
    coordsReady,
    bookForTrip,
  ] = await Promise.all([
    serverT("nav.travel"),
    serverT(PLACE_CATEGORY_KEYS[place.category]),
    serverT("place.address"),
    serverT("place.coordsReady"),
    serverT("travel.bookForTrip"),
  ]);

  return (
    <CustomerExperienceShell
      brand={brand}
      storeSlug={slug}
      multilingual={multilingual}
      className="min-h-dvh bg-[color:var(--store-paper,#F7F4EF)]"
    >
      <RememberStoreContext slug={slug} />
      <header className="border-b border-black/[0.04] bg-[color:var(--store-primary,#0F3D3E)] text-white">
        <div className="mx-auto max-w-[820px] space-y-3 px-4 py-3 md:px-5">
          <div className="flex items-center gap-2.5">
            <Link href={`/s/${slug}/travel`} className="flex min-w-0 flex-1 items-center gap-2.5">
              <StoreLogo brand={brand} size={36} className="bg-white shadow-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{navTravel}</p>
                <p className="truncate text-[11px] text-white/75">{presentation.placeLabel}</p>
              </div>
            </Link>
          </div>
          <PartnerCustomerNav
            slug={slug}
            loggedIn={Boolean(session)}
            active="travel"
            showPackages={hasPackages}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[820px]">
        <div className="relative aspect-[4/3] overflow-hidden bg-[color:var(--store-primary,#0F3D3E)] sm:aspect-[21/9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
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
              {categoryLabel}
              {place.area ? ` · ${place.area}` : ""}
              {province?.nameTh ? ` · ${province.nameTh}` : ""}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--cx-textPrimary)]">
              {place.name}
            </h1>
            {short ? <p className="mt-3 text-sm leading-6 text-muted">{short}</p> : null}
            {place.description && place.description !== short ? (
              <p className="mt-2 text-sm leading-6 text-muted">{place.description}</p>
            ) : null}
          </div>

          {place.address ? (
            <section className="rounded-2xl bg-[color:var(--cx-surface)] p-4 shadow-sm">
              <p className="text-xs font-medium text-muted">{addressLabel}</p>
              <p className="mt-1 text-sm text-[color:var(--cx-textPrimary)]">{place.address}</p>
              {place.latitude != null && place.longitude != null ? (
                <p className="mt-2 text-xs text-muted">{coordsReady}</p>
              ) : null}
            </section>
          ) : null}

          <AddToTripButton place={place} storeSlug={slug} />

          <Link
            href={`/s/${slug}?book=1`}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[color:var(--store-primary,#0F3D3E)] text-sm font-semibold text-white"
          >
            {bookForTrip}
          </Link>
        </main>
      </div>
    </CustomerExperienceShell>
  );
}
