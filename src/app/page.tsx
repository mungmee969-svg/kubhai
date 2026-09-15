import type { Metadata } from "next";
import { KubHaiLanding } from "@/components/marketing/KubHaiLanding";
import { getStore } from "@/lib/data";
import { SEED } from "@/lib/data/seed-ids";
import { normalizePartnerServiceTypes } from "@/lib/domain/partner-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KubHai ขับให้ — ค้นพบเสน่ห์แห่งล้านนา",
  description: "ค้นพบที่เที่ยว ร้านอาหาร คาเฟ่ และบริการเดินทางในภาคเหนือ",
};

export default async function HomePage() {
  const storeApi = getStore();
  const [homepage, places] = await Promise.all([
    storeApi.getPublishedHomepageConfig(),
    storeApi.listPublicPlaces({ provinceSlug: "chiang-mai" }),
  ]);
  const availablePartners = await storeApi.listPublicStores();
  const partners = homepage.agents.useAutomaticSelection
    ? availablePartners.slice(0, 1)
    : homepage.agents.businessIds
        .map((id) => availablePartners.find((item) => item.business.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const provinceId =
    places[0]?.provinceId ?? partners[0]?.province?.id ?? SEED.provinceChiangMai;

  return (
    <KubHaiLanding
      config={homepage}
      storeNamesById={Object.fromEntries(
        availablePartners.map((item) => [
          item.business.id,
          item.business.name,
        ]),
      )}
      stores={partners.map(({ business, province }) => ({
        slug: business.slug,
        name: business.name,
        shortName: business.shortName ?? business.name,
        logoUrl: business.logoUrl,
        coverUrl: business.coverUrl,
        provinceName: province?.nameTh ?? "เชียงใหม่",
        partnerServiceTypes: normalizePartnerServiceTypes(business.partnerServiceTypes),
      }))}
      places={places}
      provinceId={provinceId}
    />
  );
}
