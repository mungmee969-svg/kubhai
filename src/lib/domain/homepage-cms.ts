import { z } from "zod";

export const HOMEPAGE_SECTION_IDS = [
  "categories",
  "recommended",
  "agents",
] as const;

export const HOMEPAGE_CATEGORY_IDS = [
  "attractions",
  "restaurants",
  "cafes",
  "transport",
] as const;

export type HomepageSectionId = (typeof HOMEPAGE_SECTION_IDS)[number];
export type HomepageCategoryId = (typeof HOMEPAGE_CATEGORY_IDS)[number];

const safeHomepageLink = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine(
    (value) =>
      value.startsWith("#") ||
      value === "/" ||
      ["/places", "/stores", "/store/signup", "/account"].some(
        (prefix) => value === prefix || value.startsWith(`${prefix}?`) || value.startsWith(`${prefix}/`),
      ),
    "ลิงก์ต้องเป็นปลายทางภายใน KubHai ที่รองรับ",
  );

const safeHomepageImage = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine(
    (value) =>
      ["/home/", "/places/", "/discovery/", "/uploads/", "/brand/"].some((prefix) =>
        value.startsWith(prefix),
      ),
    "รูปภาพต้องใช้พาธสื่อภายในที่รองรับ",
  );

const shortText = z.string().trim().min(1).max(160);
const longText = z.string().trim().min(1).max(420);

const homepageCategorySchema = z.object({
  id: z.enum(HOMEPAGE_CATEGORY_IDS),
  enabled: z.boolean(),
  title: shortText,
  subtitle: shortText,
  imageUrl: safeHomepageImage,
  href: safeHomepageLink,
});

export const homepageConfigSchema = z.object({
  hero: z.object({
    enabled: z.boolean(),
    eyebrow: shortText,
    headline: shortText,
    description: longText,
    imageUrl: safeHomepageImage,
    primaryCtaEnabled: z.boolean(),
    primaryCtaLabel: shortText,
    primaryCtaHref: safeHomepageLink,
    secondaryCtaEnabled: z.boolean(),
    secondaryCtaLabel: shortText,
    secondaryCtaHref: safeHomepageLink,
  }),
  search: z.object({
    enabled: z.boolean(),
    heading: shortText,
    placeholder: shortText,
    defaultAreaLabel: shortText,
    defaultAreaSlug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80),
    popularSearches: z
      .array(z.object({ label: shortText, query: shortText }))
      .max(8),
  }),
  categories: z.array(homepageCategorySchema).length(HOMEPAGE_CATEGORY_IDS.length),
  recommended: z.object({
    enabled: z.boolean(),
    title: shortText,
    subtitle: longText,
    useAutomaticSelection: z.boolean(),
    placeIds: z.array(z.string().uuid()).max(12),
  }),
  agents: z.object({
    enabled: z.boolean(),
    title: shortText,
    subtitle: longText,
    useAutomaticSelection: z.boolean(),
    businessIds: z.array(z.string().uuid()).max(8),
  }),
  sectionOrder: z.array(z.enum(HOMEPAGE_SECTION_IDS)).length(HOMEPAGE_SECTION_IDS.length),
});

export type HomepageConfig = z.infer<typeof homepageConfigSchema>;

export type HomepageWorkspace = {
  draft: HomepageConfig;
  published: HomepageConfig;
  draftUpdatedAt: string | null;
  draftUpdatedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  hasUnpublishedChanges: boolean;
};

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
  hero: {
    enabled: true,
    eyebrow: "Discover Northern Thailand",
    headline: "ขับให้คุณค้นพบ\nเสน่ห์แห่งล้านนา",
    description:
      "เที่ยว กิน พัก เดินทาง\nรวมสถานที่และบริการที่น่าสนใจในภาคเหนือไว้ให้คุณค้นพบได้ง่ายขึ้น",
    imageUrl: "/home/lanna-hero.jpg",
    primaryCtaEnabled: true,
    primaryCtaLabel: "เริ่มค้นหา",
    primaryCtaHref: "#discover",
    secondaryCtaEnabled: true,
    secondaryCtaLabel: "ดูสถานที่แนะนำ",
    secondaryCtaHref: "#recommended",
  },
  search: {
    enabled: true,
    heading: "อยากไปไหน หรือกำลังหาอะไร?",
    placeholder: "ค้นหาที่เที่ยว ร้านอาหาร คาเฟ่",
    defaultAreaLabel: "เชียงใหม่",
    defaultAreaSlug: "chiang-mai",
    popularSearches: [
      { label: "ดอยอินทนนท์", query: "ดอยอินทนนท์" },
      { label: "ประตูท่าแพ", query: "ประตูท่าแพ" },
      { label: "นิมมาน", query: "นิมมาน" },
      { label: "แม่กำปอง", query: "แม่กำปอง" },
    ],
  },
  categories: [
    {
      id: "attractions",
      enabled: true,
      title: "ที่เที่ยว",
      subtitle: "ธรรมชาติและวัฒนธรรม",
      href: "/places?province=chiang-mai&category=ATTRACTION",
      imageUrl: "/home/category-attraction.jpg",
    },
    {
      id: "restaurants",
      enabled: true,
      title: "ร้านอาหาร",
      subtitle: "รสชาติแห่งล้านนา",
      href: "/places?province=chiang-mai&category=RESTAURANT",
      imageUrl: "/home/category-food.jpg",
    },
    {
      id: "cafes",
      enabled: true,
      title: "คาเฟ่",
      subtitle: "กาแฟและวิวดี",
      href: "/places?province=chiang-mai&category=CAFE",
      imageUrl: "/home/category-cafe.jpg",
    },
    {
      id: "transport",
      enabled: true,
      title: "รถเช่า / บริการรถ",
      subtitle: "เดินทางอย่างสบายใจ",
      href: "/stores",
      imageUrl: "/home/category-transport.jpg",
    },
  ],
  recommended: {
    enabled: true,
    title: "แนะนำในเชียงใหม่",
    subtitle: "คัดมาให้แล้ว ที่เที่ยว ร้านอาหาร และบริการที่น่าสนใจ",
    useAutomaticSelection: true,
    placeIds: [],
  },
  agents: {
    enabled: true,
    title: "เดินทางต่อกับร้านรถที่เหมาะกับคุณ",
    subtitle: "เลือกร้านรถและบริการเดินทางจากพาร์ทเนอร์ในพื้นที่",
    useAutomaticSelection: true,
    businessIds: [],
  },
  sectionOrder: ["categories", "recommended", "agents"],
};

export function normalizeHomepageWorkspace(
  value: HomepageWorkspace | null | undefined,
): HomepageWorkspace {
  if (!value) {
    return {
      draft: structuredClone(DEFAULT_HOMEPAGE_CONFIG),
      published: structuredClone(DEFAULT_HOMEPAGE_CONFIG),
      draftUpdatedAt: null,
      draftUpdatedBy: null,
      publishedAt: null,
      publishedBy: null,
      hasUnpublishedChanges: false,
    };
  }
  const draft = homepageConfigSchema.safeParse(value.draft);
  const published = homepageConfigSchema.safeParse(value.published);
  return {
    ...value,
    draft: draft.success ? draft.data : structuredClone(DEFAULT_HOMEPAGE_CONFIG),
    published: published.success
      ? published.data
      : structuredClone(DEFAULT_HOMEPAGE_CONFIG),
    hasUnpublishedChanges: Boolean(value.hasUnpublishedChanges),
  };
}

export function splitHomepageLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
