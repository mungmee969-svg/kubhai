"use client";

import { useState } from "react";
import { useCustomerPrefs } from "@/lib/i18n/CustomerPrefsProvider";
import { type CustomerLocale } from "@/lib/i18n/locales";
import type { CustomerTheme } from "@/lib/i18n/theme";

/** Visible customer theme choices — System may exist internally but is not shown. */
const VISIBLE_THEMES = ["light", "dark"] as const;

export function CustomerPrefsControls({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, allowedLocales, theme, setTheme, colorMode, t } = useCustomerPrefs();
  // If saved preference is "system", highlight the resolved mode in the 2-option UI.
  const selectedTheme: "light" | "dark" =
    theme === "light" || theme === "dark" ? theme : colorMode;
  // Thai-only plans get no language switcher at all — one option is not a choice.
  const showLocales = allowedLocales.length > 1;

  function pickTheme(next: "light" | "dark") {
    setTheme(next);
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {showLocales ? (
          <div
            className="flex rounded-full bg-black/15 p-0.5 backdrop-blur-sm dark:bg-white/12"
            role="group"
            aria-label={t("lang.label")}
          >
            {allowedLocales.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`ui-press min-h-9 rounded-full px-2.5 text-[11px] font-semibold ${
                  locale === code
                    ? "bg-[color:var(--cx-surfaceElevated,#fff)] text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))] shadow-sm"
                    : "text-current/80"
                }`}
              >
                {code === "th" ? "TH" : code === "en" ? "EN" : "中文"}
              </button>
            ))}
          </div>
        ) : null}
        <ThemeToggle selected={selectedTheme} onPick={pickTheme} t={t} compact />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showLocales ? (
        <div>
          <p className="text-xs font-medium text-[color:var(--cx-textSecondary)]">{t("lang.label")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedLocales.map((code) => (
              <LocaleChip key={code} code={code} active={locale === code} onSelect={setLocale} t={t} />
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium text-[color:var(--cx-textSecondary)]">{t("theme.label")}</p>
        <div className="mt-2">
          <ThemeToggle selected={selectedTheme} onPick={pickTheme} t={t} />
        </div>
      </div>
    </div>
  );
}

function LocaleChip({
  code,
  active,
  onSelect,
  t,
}: {
  code: CustomerLocale;
  active: boolean;
  onSelect: (code: CustomerLocale) => void;
  t: (key: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(code)}
      aria-pressed={active}
      className={`ui-press min-h-10 rounded-full px-3 text-xs font-semibold ${
        active
          ? "bg-[color:var(--store-primary,#0F3D3E)] text-white"
          : "bg-[color:var(--cx-surface)] text-[color:var(--cx-textPrimary)] ring-1 ring-[color:var(--cx-border)]"
      }`}
    >
      {t(`lang.${code}`)}
    </button>
  );
}

function ThemeToggle({
  selected,
  onPick,
  t,
  compact = false,
}: {
  selected: "light" | "dark";
  onPick: (theme: "light" | "dark") => void;
  t: (key: string) => string;
  compact?: boolean;
}) {
  return (
    <div
      className="flex rounded-full bg-black/15 p-0.5 dark:bg-white/12"
      role="group"
      aria-label={t("theme.label")}
    >
      {VISIBLE_THEMES.map((mode) => {
        const active = selected === mode;
        const label = mode === "light" ? t("theme.light") : t("theme.dark");
        const icon = mode === "light" ? "☀" : "🌙";
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onPick(mode)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={`ui-press inline-flex min-h-9 items-center justify-center gap-1 rounded-full font-semibold ${
              compact ? "min-w-9 px-2.5 text-sm" : "min-h-10 px-3 text-xs"
            } ${
              active
                ? "bg-[color:var(--cx-surfaceElevated,#fff)] text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))] shadow-sm"
                : "text-current/80"
            }`}
          >
            <span aria-hidden>{icon}</span>
            {!compact ? <span>{label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function CustomerPrefsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useCustomerPrefs();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-[color:var(--cx-overlay,rgb(0_0_0/0.45))]"
        aria-label={t("nav.close")}
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-[color:var(--cx-surfaceElevated)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[color:var(--cx-textPrimary)]">{t("nav.settings")}</h2>
          <button
            type="button"
            className="ui-press text-sm text-[color:var(--cx-textSecondary)]"
            onClick={onClose}
          >
            {t("nav.close")}
          </button>
        </div>
        <CustomerPrefsControls />
      </div>
    </div>
  );
}

export function CustomerMobilePrefsButton() {
  const [open, setOpen] = useState(false);
  const { t, locale, allowedLocales } = useCustomerPrefs();
  const badge =
    allowedLocales.length > 1 ? (locale === "zh" ? "中文" : locale.toUpperCase()) : null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-press inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-white/18 px-3 text-[11px] font-semibold text-white"
        aria-label={t("nav.settings")}
      >
        {badge ? `${badge} · ` : ""}☀🌙
      </button>
      <CustomerPrefsSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** @deprecated kept for type imports */
export type { CustomerTheme };
