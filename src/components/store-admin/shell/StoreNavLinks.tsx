"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV, STORE_NAV } from "./nav";
import { storefrontPath } from "@/lib/domain/storefront-url";

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export type NavBadgeCounts = {
  bookings?: number;
  finance?: number;
  drivers?: number;
  billing?: number;
};

function badgeForHref(href: string, badges?: NavBadgeCounts): number {
  if (!badges) return 0;
  if (href === "/store/bookings") return badges.bookings ?? 0;
  if (href === "/store/finance") return badges.finance ?? 0;
  if (href === "/store/drivers") return badges.drivers ?? 0;
  if (href === "/store/billing") return badges.billing ?? 0;
  return 0;
}

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-navy-950">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function StoreNavLinks({
  onNavigate,
  storeSlug,
  badges,
  hiddenHrefs,
}: {
  onNavigate?: () => void;
  /** Authoritative business slug — opens public storefront in new tab */
  storeSlug?: string | null;
  badges?: NavBadgeCounts;
  /** Entitlement-gated destinations the current plan cannot use */
  hiddenHrefs?: readonly string[];
}) {
  const pathname = usePathname();
  const storefrontHref = storeSlug ? storefrontPath(storeSlug) : null;
  const visible = STORE_NAV.filter((item) => !hiddenHrefs?.includes(item.href));
  const mainItems = visible.filter((item) => item.href !== "/store/settings");
  const settingsItem = visible.find((item) => item.href === "/store/settings");

  return (
    <nav className="flex-1 space-y-1 px-3">
      {mainItems.map((item) => {
        const active = isActive(pathname, item.href, "exact" in item && item.exact);
        const count = badgeForHref(item.href, badges);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
              active
                ? "bg-[color:var(--store-accent,#C4A35A)]/25 font-semibold text-inherit"
                : "text-inherit opacity-90 hover:bg-black/5"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <Badge count={count} />
          </Link>
        );
      })}
      {storefrontHref ? (
        <a
          href={storefrontHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="block rounded-xl px-3 py-2.5 text-sm text-inherit opacity-90 hover:bg-black/5"
        >
          ↗ หน้าร้านของฉัน
        </a>
      ) : null}
      {settingsItem ? (
        <Link
          href={settingsItem.href}
          onClick={onNavigate}
          className={`block rounded-xl px-3 py-2.5 text-sm ${
            isActive(pathname, settingsItem.href)
              ? "bg-[color:var(--store-accent,#C4A35A)]/25 font-semibold text-inherit"
              : "text-inherit opacity-90 hover:bg-black/5"
          }`}
          aria-current={isActive(pathname, settingsItem.href) ? "page" : undefined}
        >
          {settingsItem.label}
        </Link>
      ) : null}
    </nav>
  );
}

export function StoreMobileNav({ badges }: { badges?: NavBadgeCounts }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white px-2 py-2 lg:hidden">
      <div className="grid grid-cols-4 gap-1">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href, "exact" in item && item.exact);
          const count = badgeForHref(item.href, badges);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-xl py-2 text-center text-xs ${
                active ? "bg-navy-800 text-white" : "text-navy-800"
              }`}
            >
              {item.label}
              {count ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
