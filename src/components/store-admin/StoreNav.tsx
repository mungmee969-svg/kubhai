"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/store", label: "แดชบอร์ด", exact: true },
  { href: "/store/bookings", label: "จอง" },
  { href: "/store/calendar", label: "ปฏิทิน" },
  { href: "/store/vehicles", label: "รถ" },
  { href: "/store/drivers", label: "คนขับ" },
  { href: "/store/customers", label: "ลูกค้า" },
  { href: "/store/places", label: "สถานที่" },
  { href: "/store/settings", label: "ตั้งค่า" },
];

export function StoreNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 text-sm">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-full px-3 py-2 ${
              active ? "bg-navy-800 text-white" : "text-navy-800 hover:bg-navy-800/5"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      {showAdmin ? (
        <Link href="/admin" className="whitespace-nowrap rounded-full px-3 py-2 text-muted">
          Super Admin
        </Link>
      ) : null}
    </nav>
  );
}
