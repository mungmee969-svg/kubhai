import Link from "next/link";
import { KubHaiLanding } from "@/components/marketing/KubHaiLanding";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { SEED } from "@/lib/data/seed-ids";
import { normalizePartnerServiceTypes } from "@/lib/domain/partner-types";

export const dynamic = "force-dynamic";

export default async function HomepageDraftPreviewPage() {
  const ctx = await requirePlatformAdmin();
  const workspace = await ctx.store.getHomepageWorkspace(ctx.actor);
  const config = workspace.draft;
  const places = await ctx.store.listPublicPlaces({
    provinceSlug: config.search.defaultAreaSlug,
  });
  const availablePartners = await ctx.store.listPublicStores();
  const partners = config.agents.useAutomaticSelection
    ? availablePartners.slice(0, 1)
    : config.agents.businessIds
        .map((id) => availablePartners.find((item) => item.business.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      <aside className="sticky top-0 z-50 flex min-h-12 items-center justify-between gap-3 bg-amber-300 px-4 py-2 text-sm font-semibold text-navy-950 shadow-lg">
        <span>ตัวอย่างฉบับร่าง — ยังไม่เผยแพร่</span>
        <Link href="/admin/website" className="rounded-lg bg-navy-950 px-3 py-1.5 text-xs text-white">
          กลับไปแก้ไข
        </Link>
      </aside>
      <KubHaiLanding
        config={config}
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
          provinceName: province?.nameTh ?? config.search.defaultAreaLabel,
          partnerServiceTypes: normalizePartnerServiceTypes(
            business.partnerServiceTypes,
          ),
        }))}
        places={places}
        provinceId={
          places[0]?.provinceId ??
          partners[0]?.province?.id ??
          SEED.provinceChiangMai
        }
      />
    </>
  );
}
