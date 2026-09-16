import type { ReactNode } from "react";
import type { BusinessBranding } from "@/lib/domain/branding";
import { brandingCssVars } from "@/lib/domain/branding";
import { BrandMark } from "@/components/brand/BrandMark";

export function StoreBrandScope({
  brand,
  className = "",
  translate,
  children,
}: {
  brand: BusinessBranding;
  className?: string;
  translate?: "yes" | "no";
  children: ReactNode;
}) {
  return (
    <div className={className} style={brandingCssVars(brand)} translate={translate}>
      {children}
    </div>
  );
}

export function StoreLogo({
  brand,
  size = 40,
  className = "",
}: {
  brand: BusinessBranding;
  size?: number;
  className?: string;
}) {
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logoUrl}
        alt={brand.businessName}
        width={size}
        height={size}
        className={`rounded-[22%] object-cover shadow-sm ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-[22%] text-sm font-semibold text-white shadow-sm ${className}`}
      style={{ width: size, height: size, background: brand.primaryColor }}
      aria-hidden
    >
      {brand.shortName.slice(0, 1)}
    </div>
  );
}

export function PoweredByKubHaiSubtle({
  enabled,
  className = "",
  label = "Powered by KubHai",
}: {
  enabled: boolean;
  className?: string;
  label?: string;
}) {
  if (!enabled) return null;
  return (
    <p className={`flex items-center justify-center gap-1.5 text-[10px] text-muted/80 ${className}`}>
      <BrandMark size={14} />
      <span>{label}</span>
    </p>
  );
}

export function ContactStoreLinks({ brand }: { brand: BusinessBranding }) {
  const links: { href: string; label: string }[] = [];
  if (brand.phone) links.push({ href: `tel:${brand.phone}`, label: brand.phone });
  if (brand.lineUrl) links.push({ href: brand.lineUrl, label: "LINE" });
  if (brand.website) links.push({ href: brand.website, label: "เว็บไซต์" });
  if (brand.facebookUrl) links.push({ href: brand.facebookUrl, label: "Facebook" });
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target={item.href.startsWith("http") ? "_blank" : undefined}
          rel={item.href.startsWith("http") ? "noreferrer" : undefined}
          className="rounded-full bg-store-soft px-3 py-1.5 text-xs font-medium text-store"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}