import type { Metadata } from "next";
import { KubHaiLanding } from "@/components/marketing/KubHaiLanding";
import { getStore } from "@/lib/data";
import { SEED } from "@/lib/data/seed-ids";
import { normalizePartnerServiceTypes } from "@/lib/domain/partner-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KubHai ขับให้ — เที่ยว กิน ช้อป พัก และเดินทาง",
  description: "ค้นหาที่เที่ยว ร้านอาหาร คาเฟ่ ที่พัก และบริการเดินทางจากพาร์ทเนอร์ในภาคเหนือ",
};

export default async function HomePage() {
  const storeApi = getStore();
  const pond = await storeApi.getPublicStore("pondcarrent");
  const business = pond?.business;
  const places = await storeApi.listPublicPlaces({ provinceSlug: "chiang-mai" });
  const provinceId = pond?.province?.id ?? SEED.provinceChiangMai;

  return (
    <KubHaiLanding
      store={{
        slug: business?.slug ?? "pondcarrent",
        name: business?.name ?? "POND Car Rent",
        shortName: business?.shortName ?? "POND",
        logoUrl: business?.logoUrl ?? "/brand/pond-logo.jpg",
        coverUrl: business?.coverUrl ?? null,
        provinceName: pond?.province?.nameTh ?? "เชียงใหม่",
        partnerServiceTypes: normalizePartnerServiceTypes(business?.partnerServiceTypes),
      }}
      places={places}
      provinceId={provinceId}
    />
  );
}
