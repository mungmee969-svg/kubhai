import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontView } from "@/components/storefront/StorefrontView";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";
import { publicTripPackagesFor } from "@/lib/data/public-trip-packages";
import { allowsCustomerLocales } from "@/lib/domain/booking-entitlements";
import { publicVehicle } from "@/lib/domain/public-view";
import { trackPublicEvent } from "@/lib/actions/analytics";
import { sourceFromSearch } from "@/lib/analytics/source";
import {
  readCustomerLocaleCookie,
  readCustomerThemeCookie,
} from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type StorefrontParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: StorefrontParams): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore().getPublicStore(slug);
  if (!store) return { title: "ไม่พบร้าน" };
  const { brandingMetadata } = await import("@/components/brand/CustomerStoreChrome");
  return brandingMetadata(store.business, "จองรถ");
}

export default async function StorefrontPage({
  params,
  searchParams,
}: StorefrontParams & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await getStore().getPublicStore(slug);
  if (!data) notFound();
  const [session, initialLocale, initialTheme] = await Promise.all([
    getCustomerSession(),
    readCustomerLocaleCookie(),
    readCustomerThemeCookie(),
  ]);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") search.set(key, value);
  }
  const source = sourceFromSearch(search);
  const tripPackages = await publicTripPackagesFor(data.business);

  await trackPublicEvent({
    businessId: data.business.id,
    sessionId: "server-store-view",
    eventName: "store_view",
    eventData: { slug },
    source,
  });

  return (
    <StorefrontView
      slug={slug}
      business={data.business}
      settings={data.settings}
      vehicles={data.vehicles.map(publicVehicle)}
      places={data.places}
      region={data.region}
      province={data.province}
      tripPackages={tripPackages}
      initialSource={source}
      loggedIn={Boolean(session)}
      multilingual={allowsCustomerLocales(data.business.subscriptionPlan)}
      initialLocale={initialLocale}
      initialTheme={initialTheme}
      prefill={{
        name: session?.displayName ?? undefined,
        phone: session?.phone ?? undefined,
      }}
    />
  );
}
