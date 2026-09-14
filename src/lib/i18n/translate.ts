import type { CustomerLocale } from "./locales";
import { en } from "./messages/en";
import { th, type MessageDict } from "./messages/th";
import { zh } from "./messages/zh";

const CATALOG: Record<CustomerLocale, MessageDict> = { th, en, zh };

export type MessageKey = keyof typeof th & string;

export function translate(
  locale: CustomerLocale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const dict = CATALOG[locale] ?? th;
  let text = dict[key] ?? th[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Partner CMS / dynamic content — never fake-translate. */
export function localizedPartnerText(
  locale: CustomerLocale,
  fields: { th?: string | null; en?: string | null; zh?: string | null },
  fallback: string,
): string {
  const pick =
    locale === "en"
      ? fields.en
      : locale === "zh"
        ? fields.zh
        : fields.th;
  const value = (pick ?? fields.th ?? fields.en ?? fields.zh ?? fallback)?.trim();
  return value || fallback;
}

export function messagesFor(locale: CustomerLocale): MessageDict {
  return CATALOG[locale] ?? th;
}
