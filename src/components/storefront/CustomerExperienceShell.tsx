"use client";

import type { CSSProperties, ReactNode } from "react";
import { CustomerPrefsProvider, useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";
import { StoreBrandScope } from "@/components/brand/StoreBrand";
import type { BusinessBranding } from "@/lib/domain/branding";
import type { CustomerLocale } from "@/lib/i18n/locales";
import type { CustomerTheme } from "@/lib/i18n/theme";

/**
 * After partner brand CSS vars (inline), re-assert semantic --cx-* / ink / muted
 * so dark mode is not defeated by brand.textColor on --store-ink.
 */
function CustomerThemeTokenLayer({ children }: { children: ReactNode }) {
  const { colorMode } = useCustomerPrefs();
  const style = (
    colorMode === "dark"
      ? {
          ["--cx-bg" as string]:
            "color-mix(in srgb, var(--store-primary, #0f3d3e) 48%, #0a1018)",
          ["--cx-surface" as string]:
            "color-mix(in srgb, var(--store-primary, #0f3d3e) 32%, #141c28)",
          ["--cx-surfaceElevated" as string]:
            "color-mix(in srgb, var(--store-primary, #0f3d3e) 24%, #1c2736)",
          ["--cx-textPrimary" as string]: "#f5f2eb",
          ["--cx-textSecondary" as string]: "#c5ced8",
          ["--cx-border" as string]:
            "color-mix(in srgb, var(--store-accent, #c4a35a) 28%, #3a4658)",
          ["--cx-input" as string]:
            "color-mix(in srgb, var(--store-primary, #0f3d3e) 20%, #182231)",
          ["--cx-chip" as string]:
            "color-mix(in srgb, var(--store-primary, #0f3d3e) 26%, #1a2432)",
          /* Brand-colored text/links — never use raw dark --store-primary on dark surfaces */
          ["--cx-brandFg" as string]:
            "color-mix(in srgb, var(--store-primary, #0f3d3e) 28%, #e8f4f2)",
          ["--cx-link" as string]: "var(--cx-brandFg)",
          ["--store-paper" as string]: "var(--cx-bg)",
          ["--store-ink" as string]: "var(--cx-textPrimary)",
          ["--store-primary-soft" as string]:
            "color-mix(in srgb, var(--store-primary, #0f3d3e) 35%, #1a2836)",
          ["--kh-muted" as string]: "var(--cx-textSecondary)",
          ["--color-muted" as string]: "var(--cx-textSecondary)",
          ["--kh-line" as string]: "var(--cx-border)",
          ["--color-line" as string]: "var(--cx-border)",
          color: "var(--cx-textPrimary)",
          background: "var(--cx-bg)",
        }
      : {
          ["--cx-bg" as string]: "var(--store-paper, #f7f3ea)",
          ["--cx-surface" as string]: "#ffffff",
          ["--cx-surfaceElevated" as string]: "#ffffff",
          ["--cx-textPrimary" as string]: "var(--store-ink, #0f1724)",
          ["--cx-textSecondary" as string]: "#5b6573",
          ["--cx-border" as string]:
            "color-mix(in srgb, var(--store-primary, #0f3d3e) 12%, #e5e7eb)",
          ["--cx-input" as string]: "#ffffff",
          ["--cx-chip" as string]: "#ffffff",
          ["--cx-brandFg" as string]: "var(--store-primary, #0f3d3e)",
          ["--cx-link" as string]: "var(--cx-brandFg)",
          ["--kh-muted" as string]: "var(--cx-textSecondary)",
          ["--color-muted" as string]: "var(--cx-textSecondary)",
          color: "var(--cx-textPrimary)",
          background: "var(--cx-bg)",
        }
  ) as CSSProperties;

  return (
    <div className="customer-theme-tokens min-h-dvh" style={style} data-color-mode={colorMode}>
      {children}
    </div>
  );
}

/**
 * Partner customer experience shell: brand CSS vars + locale/theme prefs + readable tokens.
 */
export function CustomerExperienceShell({
  brand,
  storeSlug,
  className = "",
  children,
  initialLocale,
  initialTheme,
  multilingual = false,
}: {
  brand: BusinessBranding;
  storeSlug: string;
  className?: string;
  children: ReactNode;
  initialLocale?: CustomerLocale;
  initialTheme?: CustomerTheme;
  /** storefront.multilingualUi entitlement — resolved from the plan on the server. */
  multilingual?: boolean;
}) {
  return (
    <StoreBrandScope brand={brand} className={`customer-cx ${className}`}>
      <CustomerPrefsProvider
        storeSlug={storeSlug}
        initialLocale={initialLocale}
        initialTheme={initialTheme}
        multilingual={multilingual}
      >
        <CustomerThemeTokenLayer>{children}</CustomerThemeTokenLayer>
      </CustomerPrefsProvider>
    </StoreBrandScope>
  );
}
