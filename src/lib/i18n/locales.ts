/**
 * Customer-facing locale codes — intentional strategy: th | en | zh only.
 */
export const CUSTOMER_LOCALES = ["th", "en", "zh"] as const;
export type CustomerLocale = (typeof CUSTOMER_LOCALES)[number];

export const CUSTOMER_LOCALE_LABEL: Record<CustomerLocale, string> = {
  th: "ไทย",
  en: "EN",
  zh: "中文",
};

export const CUSTOMER_LOCALE_STORAGE_KEY = "kh_customer_locale";

export function isCustomerLocale(value: unknown): value is CustomerLocale {
  return value === "th" || value === "en" || value === "zh";
}

export function parseCustomerLocale(raw: string | null | undefined): CustomerLocale | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "th" || v === "thai") return "th";
  if (v === "en" || v === "eng" || v === "english") return "en";
  if (v === "zh" || v === "zh-cn" || v === "zh-tw" || v === "cn" || v === "chinese") return "zh";
  return null;
}
