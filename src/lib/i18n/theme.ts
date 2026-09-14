export const CUSTOMER_THEMES = ["light", "dark", "system"] as const;
export type CustomerTheme = (typeof CUSTOMER_THEMES)[number];

export const CUSTOMER_THEME_STORAGE_KEY = "kh_customer_theme";

export function isCustomerTheme(value: unknown): value is CustomerTheme {
  return value === "light" || value === "dark" || value === "system";
}

export function parseCustomerTheme(raw: string | null | undefined): CustomerTheme | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "light" || v === "dark" || v === "system") return v;
  return null;
}

/** Resolved visual mode after applying system preference. */
export type ResolvedColorMode = "light" | "dark";

export function resolveColorMode(
  theme: CustomerTheme,
  systemDark: boolean,
): ResolvedColorMode {
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}
