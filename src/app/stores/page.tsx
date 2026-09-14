import Link from "next/link";
import { DiscoveryShell } from "@/components/platform/DiscoveryShell";
import { getStore } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "ร้านแนะนำ" };

export default async function StoresDiscoveryPage() {
  const store = getStore();
  const partners = (
    await Promise.all([store.getPublicStore("pondcarrent"), store.getPublicStore("demo-store-002")])
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <DiscoveryShell
      title="ร้านแนะนำ"
      subtitle="เลือกดูหน้าร้าน แล้วจองรถพร้อมคนขับได้โดยตรง"
    >
      <ul className="mt-8 space-y-3">
        {partners.map((item) => (
          <li key={item.business.id}>
            <Link
              href={`/s/${item.business.slug}`}
              className="block rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-navy-950/5"
            >
              <p className="font-semibold text-navy-900">{item.business.name}</p>
              <p className="mt-1 text-sm text-muted">
                {item.province?.nameTh ?? "—"} · ดูรถและบริการ →
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </DiscoveryShell>
  );
}
