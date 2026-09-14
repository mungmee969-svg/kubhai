import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscoveryShell } from "@/components/platform/DiscoveryShell";

export const dynamic = "force-dynamic";

const REGIONS: Record<string, { nameTh: string; provinces: { slug: string; nameTh: string }[] }> = {
  north: {
    nameTh: "ภาคเหนือ",
    provinces: [
      { slug: "chiang-mai", nameTh: "เชียงใหม่" },
      { slug: "chiang-rai", nameTh: "เชียงราย" },
    ],
  },
};

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = REGIONS[slug];
  if (!region) notFound();

  return (
    <DiscoveryShell title={region.nameTh} subtitle="เลือกจังหวัดเพื่อดูร้านและบริการในพื้นที่">
      <ul className="mt-8 space-y-3">
        {region.provinces.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/province/${item.slug}`}
              className="block rounded-2xl bg-white px-4 py-4 font-semibold text-navy-900 shadow-sm ring-1 ring-navy-950/5"
            >
              {item.nameTh}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/stores" className="mt-6 inline-block text-sm font-medium text-accent-deep">
        ดูร้านทั้งหมด →
      </Link>
    </DiscoveryShell>
  );
}
