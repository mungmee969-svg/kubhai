"use client";

import Link from "next/link";
import { StoreLogo } from "@/components/brand/StoreBrand";
import type { BusinessBranding } from "@/lib/domain/branding";
import { storefrontPath } from "@/lib/domain/storefront-url";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";

export function CustomerStoreIdentityLink({
  brand,
  storeSlug,
  subtitle,
  logoSize = 36,
  className = "",
  nameClassName = "",
  subtitleClassName = "",
  showName = true,
}: {
  brand: BusinessBranding;
  storeSlug: string;
  subtitle?: string | null;
  logoSize?: number;
  className?: string;
  nameClassName?: string;
  subtitleClassName?: string;
  showName?: boolean;
}) {
  const { t } = useCustomerPrefs();

  return (
    <Link
      href={storefrontPath(storeSlug)}
      aria-label={t("nav.storeHomeLabel", { store: brand.businessName })}
      title={t("nav.storeHomeLabel", { store: brand.businessName })}
      className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}
    >
      <StoreLogo brand={brand} size={logoSize} className="shrink-0 bg-white shadow-sm" />
      {showName ? (
        <span className="min-w-0">
          <span className={`block truncate text-sm font-semibold ${nameClassName}`}>
            {brand.businessName}
          </span>
          {subtitle ? (
            <span className={`block truncate text-[11px] ${subtitleClassName}`}>{subtitle}</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
