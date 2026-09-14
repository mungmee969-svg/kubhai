"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CustomerMobilePrefsButton,
  CustomerPrefsControls,
  CustomerPrefsSheet,
} from "@/components/storefront/CustomerPrefsControls";
import { partnerLoginHref } from "@/lib/auth/customer-auth-links";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";

/**
 * Partner customer nav — Book / Travel / My Bookings + language/theme.
 * Keeps Quick Booking separate (not a 6th booking card).
 */
export function PartnerCustomerNav({
  slug,
  active,
  variant = "bar",
  loggedIn = false,
  showPackages = false,
}: {
  slug: string;
  loggedIn?: boolean;
  active: "home" | "book" | "packages" | "travel" | "account";
  variant?: "bar" | "pills";
  /** Entitled plan with at least one published package */
  showPackages?: boolean;
}) {
  const { t, allowedLocales } = useCustomerPrefs();
  const [menuOpen, setMenuOpen] = useState(false);
  const bookingsHref = loggedIn
    ? `/s/${slug}/bookings`
    : partnerLoginHref(slug, `/s/${slug}/bookings`);

  const items = [
    { key: "book" as const, href: `/s/${slug}?book=1`, label: t("nav.book") },
    ...(showPackages
      ? [{ key: "packages" as const, href: `/s/${slug}/packages`, label: t("nav.packages") }]
      : []),
    { key: "travel" as const, href: `/s/${slug}/travel`, label: t("nav.travel") },
    { key: "account" as const, href: bookingsHref, label: t("nav.myBookings") },
  ];

  if (variant === "pills") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap gap-2" aria-label={t("nav.aria")}>
          {items.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`ui-press inline-flex h-10 items-center justify-center rounded-full px-3.5 text-xs font-semibold ${
                  isActive
                    ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
                    : "bg-[color:var(--cx-surface,#fff)] text-[color:var(--cx-textPrimary,var(--store-ink,#0F1724))] ring-1 ring-black/8 dark:ring-white/12"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block">
          <CustomerPrefsControls compact />
        </div>
        <div className="md:hidden">
          <button
            type="button"
            className="ui-press inline-flex h-10 items-center rounded-full bg-[color:var(--cx-surface,#fff)] px-3 text-[11px] font-semibold ring-1 ring-black/8"
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.settings")}
          >
            {allowedLocales.length > 1 ? "TH·EN" : t("nav.settings")}
          </button>
          <CustomerPrefsSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <nav
        className={`grid gap-2 ${items.length >= 4 ? "grid-cols-4" : "grid-cols-3"}`}
        aria-label={t("nav.aria")}
      >
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`ui-press flex h-11 items-center justify-center rounded-full px-1 text-center text-[11px] font-semibold leading-tight ${
                isActive
                  ? "bg-white text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
                  : "bg-white/18 text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center justify-end gap-2">
        <div className="hidden sm:block">
          <CustomerPrefsControls compact />
        </div>
        <div className="sm:hidden">
          <CustomerMobilePrefsButton />
        </div>
      </div>
    </div>
  );
}
