import Link from "next/link";
import { DiscoveryShell } from "@/components/platform/DiscoveryShell";

export const metadata = { title: "บริการ" };

const SERVICES = [
  { title: "รถพร้อมคนขับ", href: "/stores", note: "รายวัน / ตามงาน" },
  { title: "รับส่งสนามบิน", href: "/stores", note: "จุดรับ–ส่งชัดเจน" },
  { title: "รับส่งจุดต่อจุด", href: "/stores", note: "ในเมืองหรือระหว่างจุด" },
  { title: "จัดทริป / หลายวัน", href: "/stores", note: "แผนวันต่อวันผ่านร้าน" },
];

export default function ServicesPage() {
  return (
    <DiscoveryShell title="บริการ" subtitle="เลือกบริการที่เหมาะกับทริปของคุณ แล้วดูร้านที่พร้อมให้บริการ">
      <ul className="mt-8 space-y-3">
        {SERVICES.map((item) => (
          <li key={item.title}>
            <Link
              href={item.href}
              className="block rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-navy-950/5"
            >
              <p className="font-semibold text-navy-900">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.note}</p>
            </Link>
          </li>
        ))}
      </ul>
    </DiscoveryShell>
  );
}
