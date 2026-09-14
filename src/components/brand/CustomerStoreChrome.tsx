import type { ReactNode } from "react";
import { resolveBusinessBranding } from "@/lib/domain/branding";
import {
  ContactStoreLinks,
  StoreBrandScope,
  StoreLogo,
} from "@/components/brand/StoreBrand";
import type { Business } from "@/lib/domain/types";

/** Shared customer chrome for store-scoped pages (storefront / booking / account). */
export function CustomerStoreChrome({
  business,
  children,
  rightSlot,
  title,
}: {
  business: Business;
  children: ReactNode;
  rightSlot?: ReactNode;
  title?: string;
}) {
  const brand = resolveBusinessBranding(business);
  return (
    <StoreBrandScope brand={brand} className="min-h-dvh bg-store-paper text-[color:var(--store-ink,#0F1724)]">
      <header className="bg-store text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <StoreLogo brand={brand} size={40} className="bg-white" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{brand.businessName}</p>
              {title ? <p className="truncate text-[11px] text-white/70">{title}</p> : null}
            </div>
          </div>
          {rightSlot}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-5 py-6">{children}</main>
      <footer className="mx-auto max-w-lg space-y-3 px-5 pb-10">
        <div>
          <p className="text-xs font-semibold text-store">ติดต่อร้าน</p>
          <div className="mt-2">
            <ContactStoreLinks brand={brand} />
          </div>
          {brand.customerSupportText ? (
            <p className="mt-2 text-xs text-muted">{brand.customerSupportText}</p>
          ) : null}
        </div>
      </footer>
    </StoreBrandScope>
  );
}

export function brandingMetadata(business: Business, pageTitle?: string) {
  const brand = resolveBusinessBranding(business);
  const title = pageTitle ? `${pageTitle} | ${brand.businessName}` : brand.businessName;
  return {
    title,
    description: business.description ?? `จองกับ ${brand.businessName}`,
    icons: brand.faviconUrl ? [{ url: brand.faviconUrl }] : undefined,
  };
}
