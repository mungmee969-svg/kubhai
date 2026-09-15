import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RememberStoreContext } from "@/components/brand/RememberStoreContext";
import { CustomerStoreIdentityLink } from "@/components/brand/CustomerStoreIdentityLink";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { PartnerCustomerNav } from "@/components/storefront/PartnerCustomerNav";
import { PartnerTravelDiscovery } from "@/components/storefront/PartnerTravelDiscovery";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { publicTripPackagesFor } from "@/lib/data/public-trip-packages";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import {
  allowsCustomerLocales,
  allowsTripDiscovery,
} from "@/lib/domain/booking-entitlements";
import { readCustomerLocaleCookie, readCustomerThemeCookie } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const locale = await readCustomerLocaleCookie();
  const travelTitle = translate(locale, "travel.title");
  const store = await getStore().getPublicStore(slug);
  if (!store) return { title: travelTitle };
  return { title: `${travelTitle} · ${store.business.name}` };
}

export default async function PartnerTravelPage({ params }: Params) {
  const { slug } = await params;
  const data = await getStore().getPublicStore(slug);
  if (!data) notFound();
  if (!allowsTripDiscovery(data.business.subscriptionPlan)) notFound();
  const [session, initialLocale, initialTheme] = await Promise.all([
    getCustomerSession(),
    readCustomerLocaleCookie(),
    readCustomerThemeCookie(),
  ]);
  const brand = resolveCustomerStorefrontBranding(data.business);
  const multilingual = allowsCustomerLocales(data.business.subscriptionPlan);
  const hasPackages = (await publicTripPackagesFor(data.business)).length > 0;
  const presentation = resolveBookingPresentation({
    business: data.business,
    province: data.province,
    region: data.region,
  });

  return (
    <CustomerExperienceShell
      brand={brand}
      storeSlug={slug}
      multilingual={multilingual}
      initialLocale={initialLocale}
      initialTheme={initialTheme}
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
            active="travel"
            showPackages={hasPackages}
          />
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-4 py-6 md:px-5">
        <PartnerTravelDiscovery
          places={data.places}
          provinceId={data.business.provinceId}
          storeSlug={slug}
          locationLabel={presentation.placeLabel}
          mode="full"
        />
      </main>
    </CustomerExperienceShell>
  );
}
