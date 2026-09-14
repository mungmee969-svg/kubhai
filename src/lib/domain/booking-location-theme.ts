/**
 * Location / travel atmosphere for booking surfaces.
 * Independent of Partner brand. Never falls back to POND or vehicle imagery.
 */

import { SEED } from "@/lib/data/seed-ids";

export type BookingLocationTheme = {
  themeId: string;
  labelTh: string;
  desktopHeroImage: string;
  /** Dedicated mobile crop when available; null → use desktop + object-position. */
  mobileHeroImage: string | null;
  objectPositionDesktop: string;
  objectPositionMobile: string;
  /** Soft decorative accent under hero (optional). */
  decorativeAccentUrl: string | null;
};

export type LocationThemeInput = {
  provinceId?: string | null;
  provinceSlug?: string | null;
  provinceNameTh?: string | null;
  regionId?: string | null;
  regionSlug?: string | null;
  regionNameTh?: string | null;
};

const CHIANG_MAI: BookingLocationTheme = {
  themeId: "location.chiang-mai",
  labelTh: "เชียงใหม่",
  desktopHeroImage: "/themes/chiang-mai/hero-desktop.jpg",
  mobileHeroImage: null,
  // Bias toward left sunrise / pagoda; keep SUV from dominating mobile crop
  objectPositionDesktop: "42% 45%",
  objectPositionMobile: "28% 40%",
  decorativeAccentUrl: null,
};

const NORTHERN: BookingLocationTheme = {
  themeId: "location.northern-thailand",
  labelTh: "ภาคเหนือ",
  desktopHeroImage: "/discovery/placeholders/hero-north.svg",
  mobileHeroImage: null,
  objectPositionDesktop: "50% 40%",
  objectPositionMobile: "50% 35%",
  decorativeAccentUrl: null,
};

const GENERIC_KUBHAI: BookingLocationTheme = {
  themeId: "location.kubhai-travel",
  labelTh: "ท่องเที่ยว",
  desktopHeroImage: "/themes/generic/kubhai-travel.svg",
  mobileHeroImage: null,
  objectPositionDesktop: "50% 45%",
  objectPositionMobile: "50% 40%",
  decorativeAccentUrl: null,
};

const PROVINCE_THEMES: Record<string, BookingLocationTheme> = {
  "chiang-mai": CHIANG_MAI,
  chiangmai: CHIANG_MAI,
};

const PROVINCE_ID_SLUG: Record<string, string> = {
  [SEED.provinceChiangMai]: "chiang-mai",
  [SEED.provinceChiangRai]: "chiang-rai",
};

const NORTHERN_SLUGS = new Set([
  "chiang-mai",
  "chiangmai",
  "chiang-rai",
  "chiangrai",
  "nan",
  "lamphun",
  "lampang",
  "phrae",
  "mae-hong-son",
  "uttaradit",
  "phayao",
]);

function normalizeSlug(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function looksLikeChiangMai(name: string | null | undefined): boolean {
  const t = (name || "").trim();
  return t.includes("เชียงใหม่") || /chiang\s*mai/i.test(t);
}

function looksNorthern(name: string | null | undefined): boolean {
  const t = (name || "").trim();
  return t.includes("เหนือ") || /north/i.test(t);
}

/**
 * Resolve travel atmosphere from store location — never Partner identity.
 */
export function resolveBookingLocationTheme(input: LocationThemeInput): BookingLocationTheme {
  const provinceSlug =
    normalizeSlug(input.provinceSlug) ||
    (input.provinceId ? PROVINCE_ID_SLUG[input.provinceId] ?? "" : "");

  if (provinceSlug && PROVINCE_THEMES[provinceSlug]) {
    return PROVINCE_THEMES[provinceSlug];
  }
  if (looksLikeChiangMai(input.provinceNameTh) || looksLikeChiangMai(input.provinceSlug)) {
    return CHIANG_MAI;
  }

  const regionSlug = normalizeSlug(input.regionSlug);
  const isNorthern =
    NORTHERN_SLUGS.has(provinceSlug) ||
    regionSlug === "north" ||
    regionSlug === "northern" ||
    regionSlug.includes("north") ||
    looksNorthern(input.regionNameTh) ||
    input.regionId === SEED.regionNorth;

  if (isNorthern) {
    return NORTHERN;
  }

  if (provinceSlug || input.provinceNameTh || regionSlug || input.regionNameTh || input.provinceId) {
    return GENERIC_KUBHAI;
  }

  return GENERIC_KUBHAI;
}

export const BOOKING_LOCATION_THEME_FIXTURES = {
  CHIANG_MAI,
  NORTHERN,
  GENERIC_KUBHAI,
} as const;
