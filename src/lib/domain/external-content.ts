/**
 * Source-aware external content foundation (reviews / news / media metadata).
 * KubHai stores attribution + short summary only — not full third-party bodies.
 * Do NOT scrape providers in this module.
 */

export const EXTERNAL_CONTENT_SOURCE_TYPES = [
  "YOUTUBE",
  "TIKTOK",
  "FACEBOOK",
  "INSTAGRAM",
  "BLOG",
  "NEWS",
  "TOURISM_OFFICIAL",
  "OTHER",
] as const;
export type ExternalContentSourceType = (typeof EXTERNAL_CONTENT_SOURCE_TYPES)[number];

export const EXTERNAL_CONTENT_KINDS = [
  "REVIEW",
  "NEWS",
  "EVENT",
  "GUIDE",
  "VIDEO",
  "SOCIAL_POST",
] as const;
export type ExternalContentKind = (typeof EXTERNAL_CONTENT_KINDS)[number];

export const EXTERNAL_CONTENT_STATUSES = [
  "ACTIVE",
  "HIDDEN",
  "SOURCE_UNAVAILABLE",
] as const;
export type ExternalContentStatus = (typeof EXTERNAL_CONTENT_STATUSES)[number];

export type ExternalContentItem = {
  id: string;
  kind: ExternalContentKind;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceType: ExternalContentSourceType;
  authorOrChannel: string | null;
  publishedAt: string | null;
  fetchedAt: string | null;
  /** Only when provider rules allow; never a scraped full asset dump. */
  thumbnailUrl: string | null;
  externalContentId: string | null;
  placeId: string | null;
  provinceId: string | null;
  regionId: string | null;
  status: ExternalContentStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function isDisplayableExternalContent(item: ExternalContentItem): boolean {
  return item.status === "ACTIVE" && Boolean(item.sourceUrl?.trim()) && Boolean(item.sourceName?.trim());
}

export function externalContentAttribution(item: ExternalContentItem): {
  label: string;
  sourceUrl: string;
  cta: string;
} {
  return {
    label: `อ้างอิงจาก: ${item.sourceName}`,
    sourceUrl: item.sourceUrl,
    cta: "ดูต้นฉบับ",
  };
}

export function normalizeExternalContent(
  raw: Partial<ExternalContentItem> &
    Pick<ExternalContentItem, "id" | "kind" | "title" | "sourceName" | "sourceUrl" | "sourceType">,
): ExternalContentItem {
  const now = "2026-09-13T00:00:00.000Z";
  const status = (EXTERNAL_CONTENT_STATUSES as readonly string[]).includes(raw.status ?? "")
    ? (raw.status as ExternalContentStatus)
    : "ACTIVE";
  return {
    id: raw.id,
    kind: raw.kind,
    title: raw.title,
    summary: raw.summary ?? null,
    sourceName: raw.sourceName,
    sourceUrl: raw.sourceUrl,
    sourceType: raw.sourceType,
    authorOrChannel: raw.authorOrChannel ?? null,
    publishedAt: raw.publishedAt ?? null,
    fetchedAt: raw.fetchedAt ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    externalContentId: raw.externalContentId ?? null,
    placeId: raw.placeId ?? null,
    provinceId: raw.provinceId ?? null,
    regionId: raw.regionId ?? null,
    status,
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : 100,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  };
}
