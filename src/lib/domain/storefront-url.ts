/**
 * Public customer storefront URL helpers.
 * Path is always /s/{slug} from authoritative Business.slug.
 */

export function storefrontPath(slug: string): string {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  return `/s/${encodeURIComponent(clean)}`;
}

/** Absolute URL when origin is known; otherwise returns path only. */
export function storefrontAbsoluteUrl(slug: string, origin?: string | null): string {
  const path = storefrontPath(slug);
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}

/** Human-readable display without inventing a production domain. */
export function storefrontDisplayUrl(slug: string, host?: string | null): string {
  const path = storefrontPath(slug).replace(/^\//, "");
  if (host && host.trim()) return `${host.replace(/\/$/, "")}/${path}`;
  return path;
}
