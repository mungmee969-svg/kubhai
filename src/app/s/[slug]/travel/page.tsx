import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RememberStoreContext } from "@/components/brand/RememberStoreContext";
import { StoreLogo } from "@/components/brand/StoreBrand";
import { CustomerExperienceShell } from "@/components/storefront/CustomerExperienceShell";
import { PartnerCustomerNav } from "@/components/storefront/PartnerCustomerNav";
import { PartnerTravelDiscovery } from "@/components/storefront/PartnerTravelDiscovery";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { publicTripPackagesFor } from "@/lib/data/public-trip-packages";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import { resolveCustomerStorefrontBranding } from "@/lib/domain/branding";
import { allowsCustomerLocales } from "@/lib/domain/booking-entitlements";
import { readCustomerLocaleCookie } from "@/lib/i18n/server";
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
  const session = await getCustomerSession();
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
      className="min-h-dvh bg-[color:var(--store-paper,#F7F4EF)]"
    >
      <RememberStoreContext slug={slug} />
      <header className="border-b border-black/[0.04] bg-[color:var(--store-primary,#0F3D3E)] text-white">
        <div className="mx-auto max-w-[820px] space-y-3 px-4 py-3 md:px-5">
          <div className="flex items-center gap-2.5">
            <Link href={`/s/${slug}`} className="flex min-w-0 flex-1 items-center gap-2.5">
              <StoreLogo brand={brand} size={36} className="bg-white shadow-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{brand.businessName}</p>
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
