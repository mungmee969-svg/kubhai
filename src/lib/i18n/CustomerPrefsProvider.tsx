"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CUSTOMER_LOCALES,
  CUSTOMER_LOCALE_STORAGE_KEY,
  isCustomerLocale,
  type CustomerLocale,
} from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import {
  CUSTOMER_THEME_STORAGE_KEY,
  isCustomerTheme,
  resolveColorMode,
  type CustomerTheme,
  type ResolvedColorMode,
} from "@/lib/i18n/theme";

type CustomerPrefsContextValue = {
  locale: CustomerLocale;
  setLocale: (locale: CustomerLocale) => void;
  /** Locales this storefront's plan is entitled to offer. Always contains "th". */
  allowedLocales: readonly CustomerLocale[];
  theme: CustomerTheme;
  setTheme: (theme: CustomerTheme) => void;
  colorMode: ResolvedColorMode;
  t: (key: string, params?: Record<string, string | number>) => string;
  storeSlug: string | null;
};

const THAI_ONLY: readonly CustomerLocale[] = ["th"];

const CustomerPrefsContext = createContext<CustomerPrefsContextValue | null>(null);

function readStoredLocale(): CustomerLocale {
  if (typeof window === "undefined") return "th";
  try {
    const raw = window.localStorage.getItem(CUSTOMER_LOCALE_STORAGE_KEY);
    if (isCustomerLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "th";
}

function readStoredTheme(): CustomerTheme {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(CUSTOMER_THEME_STORAGE_KEY);
    if (isCustomerTheme(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

function readSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDomPrefs(locale: CustomerLocale, colorMode: ResolvedColorMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = locale === "zh" ? "zh-Hans" : locale;
  root.dataset.customerTheme = colorMode;
  root.classList.toggle("customer-dark", colorMode === "dark");
  root.classList.toggle("customer-light", colorMode === "light");
}

export function CustomerPrefsProvider({
  children,
  storeSlug = null,
  initialLocale,
  initialTheme,
  multilingual = false,
}: {
  children: ReactNode;
  storeSlug?: string | null;
  initialLocale?: CustomerLocale;
  initialTheme?: CustomerTheme;
  /** storefront.multilingualUi entitlement — without it the storefront is Thai-only. */
  multilingual?: boolean;
}) {
  const allowedLocales = multilingual ? CUSTOMER_LOCALES : THAI_ONLY;
  const [storedLocale, setLocaleState] = useState<CustomerLocale>(
    () => initialLocale ?? readStoredLocale(),
  );
  // A stored EN/ZH preference must not leak into a Thai-only storefront.
  const locale = allowedLocales.includes(storedLocale) ? storedLocale : "th";
  const [theme, setThemeState] = useState<CustomerTheme>(
    () => initialTheme ?? readStoredTheme(),
  );
  const [systemDark, setSystemDark] = useState(readSystemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const colorMode = resolveColorMode(theme, systemDark);

  useEffect(() => {
    applyDomPrefs(locale, colorMode);
  }, [locale, colorMode]);

  const setLocale = useCallback(
    (next: CustomerLocale) => {
      if (!allowedLocales.includes(next)) return;
      setLocaleState(next);
      try {
        window.localStorage.setItem(CUSTOMER_LOCALE_STORAGE_KEY, next);
        document.cookie = `${CUSTOMER_LOCALE_STORAGE_KEY}=${next};path=/;max-age=31536000;samesite=lax`;
      } catch {
        /* ignore */
      }
    },
    [allowedLocales],
  );

  const setTheme = useCallback((next: CustomerTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(CUSTOMER_THEME_STORAGE_KEY, next);
      document.cookie = `${CUSTOMER_THEME_STORAGE_KEY}=${next};path=/;max-age=31536000;samesite=lax`;
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, allowedLocales, theme, setTheme, colorMode, t, storeSlug }),
    [locale, setLocale, allowedLocales, theme, setTheme, colorMode, t, storeSlug],
  );

  return (
    <CustomerPrefsContext.Provider value={value}>{children}</CustomerPrefsContext.Provider>
  );
}

export function useCustomerPrefs(): CustomerPrefsContextValue {
  const ctx = useContext(CustomerPrefsContext);
  if (!ctx) {
    return {
      locale: "th",
      setLocale: () => undefined,
      allowedLocales: THAI_ONLY,
      theme: "system",
      setTheme: () => undefined,
      colorMode: "light",
      t: (key, params) => translate("th", key, params),
      storeSlug: null,
    };
  }
  return ctx;
}

export function useCustomerT() {
  return useCustomerPrefs().t;
}
