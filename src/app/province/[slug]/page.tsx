import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscoveryShell } from "@/components/platform/DiscoveryShell";
import { getStore } from "@/lib/data";

export const dynamic = "force-dynamic";

const PROVINCES: Record<string, { nameTh: string; regionSlug: string; regionName: string }> = {
  "chiang-mai": { nameTh: "เชียงใหม่", regionSlug: "north", regionName: "ภาคเหนือ" },
  "chiang-rai": { nameTh: "เชียงราย", regionSlug: "north", regionName: "ภาคเหนือ" },
};

export default async function ProvincePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const province = PROVINCES[slug];
  if (!province) notFound();

  const store = getStore();
  const partners = (
    await Promise.all([store.getPublicStore("pondcarrent"), store.getPublicStore("demo-store-002")])
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const inProvince = partners.filter(
    (item) => item.province?.slug === slug || (slug === "chiang-mai" && item.business.slug === "pondcarrent"),
  );

  return (
    <DiscoveryShell title={province.nameTh} subtitle={`ร้านและบริการใน${province.nameTh}`}>
      <p className="mt-4 text-sm text-muted">
        <Link href={`/region/${province.regionSlug}`} className="text-accent-deep hover:underline">
          ← {province.regionName}
        </Link>
      </p>
      <ul className="mt-8 space-y-3">
        {inProvince.length === 0 ? (
          <li className="rounded-2xl bg-white px-4 py-4 text-sm text-muted shadow-sm ring-1 ring-navy-950/5">
            ยังไม่มีร้านในจังหวัดนี้
          </li>
        ) : (
          inProvince.map((item) => (
            <li key={item.business.id}>
              <Link
                href={`/s/${item.business.slug}`}
                className="block rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-navy-950/5"
              >
                <p className="font-semibold text-navy-900">{item.business.name}</p>
                <p className="mt-1 text-sm text-muted">ดูรถและบริการ →</p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </DiscoveryShell>
  );
}
