import { cookies } from "next/headers";
import { CUSTOMER_LOCALE_STORAGE_KEY, isCustomerLocale, type CustomerLocale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { CUSTOMER_THEME_STORAGE_KEY, isCustomerTheme, type CustomerTheme } from "@/lib/i18n/theme";

export async function readCustomerLocaleCookie(): Promise<CustomerLocale> {
  const jar = await cookies();
  const raw = jar.get(CUSTOMER_LOCALE_STORAGE_KEY)?.value;
  return isCustomerLocale(raw) ? raw : "th";
}

export async function readCustomerThemeCookie(): Promise<CustomerTheme> {
  const jar = await cookies();
  const raw = jar.get(CUSTOMER_THEME_STORAGE_KEY)?.value;
  return isCustomerTheme(raw) ? raw : "system";
}

export async function serverT(key: string, params?: Record<string, string | number>) {
  const locale = await readCustomerLocaleCookie();
  return translate(locale, key, params);
}
