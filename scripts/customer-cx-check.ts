/**
 * Customer CX white-label + i18n + theme regression checks.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { BOOKING_WIZARD_MAX_STEP } from "../src/lib/booking/draft";
import {
  bookingDetailClaimPath,
  partnerBookingsClaimPath,
  partnerLoginHref,
  partnerLoginHrefWithClaim,
  platformLoginHref,
} from "../src/lib/auth/customer-auth-links";
import {
  allowsCustomerLocales,
  allowsTripDiscovery,
  allowsTripPackages,
  isWhiteLabelStorefront,
  planResourceLimits,
} from "../src/lib/domain/booking-entitlements";
import { translate } from "../src/lib/i18n/translate";
import { CUSTOMER_LOCALES } from "../src/lib/i18n/locales";
import { resolveColorMode } from "../src/lib/i18n/theme";
import { th } from "../src/lib/i18n/messages/th";
import { en } from "../src/lib/i18n/messages/en";
import { zh } from "../src/lib/i18n/messages/zh";

let failed = 0;
function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

assert("Quick Booking still 5 cards", BOOKING_WIZARD_MAX_STEP === 5);

assert(
  "partner login retains store",
  partnerLoginHref("pondcarrent", "/s/pondcarrent/bookings").includes("store=pondcarrent") &&
    partnerLoginHref("pondcarrent", "/s/pondcarrent/bookings").includes("next="),
);
assert("platform login uses context=platform", platformLoginHref("/account").includes("context=platform"));

// —— P0: guest booking claim survives login ——
const CLAIM_TOKEN = "tok_abcdefghijklmnopqrstuvwxyz";
const claimLogin = partnerLoginHrefWithClaim("pondcarrent", "/s/pondcarrent/bookings", CLAIM_TOKEN);
assert("claim login keeps store", claimLogin.includes("store=pondcarrent"));
assert(
  "claim login carries token in next",
  claimLogin.includes(encodeURIComponent(`/s/pondcarrent/bookings?claim=${CLAIM_TOKEN}`)),
);
assert(
  "claim login without token falls back to plain login",
  partnerLoginHrefWithClaim("pondcarrent", "/s/pondcarrent/bookings", "") ===
    partnerLoginHref("pondcarrent", "/s/pondcarrent/bookings"),
);
assert(
  "bookings claim path",
  partnerBookingsClaimPath("pondcarrent", CLAIM_TOKEN) ===
    `/s/pondcarrent/bookings?claim=${CLAIM_TOKEN}`,
);
assert("booking detail claim path", bookingDetailClaimPath(CLAIM_TOKEN) === `/booking/${CLAIM_TOKEN}?claim=1`);

// —— Plan entitlements drive customer surfaces ——
assert("starter storefront is not white-label", !isWhiteLabelStorefront("starter"));
assert("pro storefront is white-label", isWhiteLabelStorefront("pro"));
assert("business storefront is white-label", isWhiteLabelStorefront("business"));
assert("starter is Thai-only", !allowsCustomerLocales("starter"));
assert("pro unlocks customer locales", allowsCustomerLocales("pro"));
assert("starter has no trip discovery", !allowsTripDiscovery("starter"));
assert("starter has no trip packages", !allowsTripPackages("starter"));
assert("pro unlocks trips", allowsTripDiscovery("pro") && allowsTripPackages("pro"));
assert("starter vehicles capped at 3", planResourceLimits("starter").maxVehicles === 3);
assert("starter drivers cap not invented", planResourceLimits("starter").maxDrivers === null);
assert("pro vehicles capped at 10", planResourceLimits("pro").maxVehicles === 10);
assert("pro drivers capped at 10", planResourceLimits("pro").maxDrivers === 10);
assert(
  "business fleet caps not invented",
  planResourceLimits("business").maxVehicles === null &&
    planResourceLimits("business").maxDrivers === null,
);

const keys = Object.keys(th);
assert("catalogs same size", keys.length === Object.keys(en).length && keys.length === Object.keys(zh).length);
assert(
  "catalogs key parity",
  keys.every((key) => key in en && key in zh),
);
assert(
  "en/zh have no extra keys vs th",
  Object.keys(en).every((key) => key in th) && Object.keys(zh).every((key) => key in th),
);
assert("storefront.heroTitle present", "storefront.heroTitle" in th && "storefront.heroTitle" in en);
assert("travel.subtitle present", "travel.subtitle" in th && "travel.all" in zh);

for (const locale of CUSTOMER_LOCALES) {
  assert(`${locale} nav.myBookings`, Boolean(translate(locale, "nav.myBookings")));
  assert(`${locale} booking.step.1`, Boolean(translate(locale, "booking.step.1")));
  assert(`${locale} storefront.heroTitle`, Boolean(translate(locale, "storefront.heroTitle")));
  assert(`${locale} travel.title`, Boolean(translate(locale, "travel.title")));
}

assert("theme system→dark", resolveColorMode("system", true) === "dark");
assert("theme system→light", resolveColorMode("system", false) === "light");
assert("theme dark forced", resolveColorMode("dark", false) === "dark");
assert("theme.system kept for compat", "theme.system" in th && "theme.system" in en);

const nav = read("src/components/storefront/PartnerCustomerNav.tsx");
assert("nav has My Bookings", nav.includes("nav.myBookings") || nav.includes("myBookings"));
assert("nav uses partnerLoginHref", nav.includes("partnerLoginHref"));

const provider = read("src/lib/i18n/CustomerPrefsProvider.tsx");
const prefs = read("src/components/storefront/CustomerPrefsControls.tsx");
assert("prefs no Aa placeholder", !prefs.includes('"Aa"') && !prefs.includes("'Aa'"));
assert("prefs no mystery half-circle", !prefs.includes("◐") && !prefs.includes("◎"));
assert(
  "prefs visible themes light+dark only",
  prefs.includes('VISIBLE_THEMES = ["light", "dark"]') ||
    (prefs.includes('"light"') && prefs.includes('"dark"') && !prefs.includes("setTheme(\"system\")")),
);
assert(
  "ThemeToggle uses sun/moon or theme labels",
  (prefs.includes("☀") && prefs.includes("🌙")) ||
    (prefs.includes("theme.light") && prefs.includes("theme.dark")),
);
assert("prefs does not expose theme.system button", !prefs.includes('t("theme.system")') && !prefs.includes("theme.system"));

const storefront = read("src/components/storefront/PartnerStorefront.tsx");
assert("storefront no PoweredBy", !storefront.includes("PoweredByKubHai"));
assert("storefront uses CustomerExperienceShell", storefront.includes("CustomerExperienceShell"));
assert("storefront uses storefront.heroTitle", storefront.includes("storefront.heroTitle"));
assert("storefront no hardcoded Thai hero", !storefront.includes("เดินทางเชียงใหม่"));

const travel = read("src/components/storefront/PartnerTravelDiscovery.tsx");
assert("travel uses travel.title", travel.includes("travel.title"));
assert("travel uses useCustomerPrefs", travel.includes("useCustomerPrefs"));
assert("travel no hardcoded เที่ยวแนะนำ", !travel.includes("เที่ยวแนะนำ"));
assert("travel no PLACE_CATEGORY_LABELS", !travel.includes("PLACE_CATEGORY_LABELS"));
assert("travel uses category keys", travel.includes("PLACE_CATEGORY_KEYS") || travel.includes("travel.popular"));
assert("travel uses cx-textPrimary", travel.includes("--cx-textPrimary"));

const shell = read("src/components/storefront/CustomerExperienceShell.tsx");
assert(
  "shell has theme token layer",
  shell.includes("CustomerThemeTokenLayer") || shell.includes("customer-theme-tokens"),
);
assert("shell remaps store-ink in dark", shell.includes("--store-ink") && shell.includes("cx-textPrimary"));
assert("shell has cx-brandFg for dark links", shell.includes("--cx-brandFg"));

assert("place.category.spa synced", "place.category.spa" in th && "place.category.spa" in en && "place.category.spa" in zh);

const wizard = read("src/components/storefront/BookingWizard.tsx");
assert("wizard no PoweredBy", !wizard.includes("PoweredByKubHai"));
assert("wizard uses t()", wizard.includes("useCustomerPrefs") || wizard.includes(".t(") || wizard.includes(" t("));

const success = read("src/app/booking/[token]/success/page.tsx");
assert("success view details CTA", success.includes("ดูรายละเอียดการจอง") || success.includes("success.viewDetails"));
assert("success my bookings partner path", success.includes("/bookings"));
assert("success no PoweredBy", !success.includes("PoweredByKubHai"));
assert("success carries claim through login", success.includes("partnerLoginHrefWithClaim"));
assert("success claims directly when logged in", success.includes("partnerBookingsClaimPath"));

const tokenPage = read("src/app/booking/[token]/page.tsx");
assert("token page mounts account banner", tokenPage.includes("BookingAccountBanner"));
assert("token page passes storeSlug to banner", tokenPage.includes("storeSlug={business.slug}"));
assert("token page retries claim from query", tokenPage.includes('query.claim === "1"'));
assert("token page claims only when phone verified", tokenPage.includes("session?.phoneVerified"));

const banner = read("src/components/booking/BookingAccountBanner.tsx");
assert("banner is partner-aware (no KubHai account copy)", !banner.includes("บัญชี KubHai"));
assert("banner takes partner store name", banner.includes("storeName"));
assert("banner login carries claim token", banner.includes("partnerLoginHrefWithClaim"));
assert("banner phone verify returns to claim", banner.includes("bookingDetailClaimPath"));
assert("banner link copy for claim", banner.includes("ยืนยันเบอร์โทรเพื่อเชื่อมการจอง"));

const customerAuthActions = read("src/lib/actions/customer-auth.ts");
assert(
  "claim action asks to verify phone for linking",
  customerAuthActions.includes("ยืนยันเบอร์โทรเพื่อเชื่อมการจอง") &&
    !customerAuthActions.includes("ยืนยันเบอร์โทรเพื่อทำการจอง"),
);

const localStore = read("src/lib/data/local-store.ts");
assert(
  "claim still requires token possession + verified phone",
  localStore.includes("requireVerifiedCustomerAccount") &&
    localStore.includes("item.securePublicToken === token") &&
    localStore.includes("phonesMatch(account.phoneNormalized, booking.customerPhoneSnapshot)"),
);
assert(
  "listing is accountId-only (never by phone)",
  localStore.includes("item.customerAccountId === customerAccountId"),
);
assert("plan caps enforced on create", localStore.includes("assertPlanResourceHeadroom"));

const branding = read("src/lib/domain/branding.ts");
assert("customer branding gates on white-label", branding.includes("isWhiteLabelStorefront"));
assert("non-white-label falls back to KubHai brand", branding.includes("kubhaiBrand.logoSrc"));
assert("white-label customer journey hides KubHai", branding.includes("poweredByKubHaiEnabled: false"));

const authCtx = read("src/lib/auth/customer-auth-context.ts");
assert(
  "partner login subtitle for bookings",
  authCtx.includes("เข้าสู่ระบบเพื่อดูการจองของคุณ"),
);
assert("partner poweredBy forced false", authCtx.includes("poweredByKubHaiEnabled: false"));

const bookingsPage = read("src/app/s/[slug]/bookings/page.tsx");
assert("partner my bookings route", bookingsPage.includes("listCustomerBookings"));
assert("partner bookings filter by businessId", bookingsPage.includes("businessId === store.business.id"));
assert("partner bookings reads claim param", bookingsPage.includes("query.claim"));
assert("partner bookings claims on arrival", bookingsPage.includes("claimBookingByToken"));
assert(
  "partner bookings redirects to clean url after claim",
  bookingsPage.includes("redirect(`/s/${slug}/bookings`)"),
);
assert("partner bookings explains a blocked claim", bookingsPage.includes("myBookings.claimPending"));
assert("partner bookings is plan-aware", bookingsPage.includes("allowsCustomerLocales"));

// —— Plan-aware locale switcher ——
assert("shell accepts multilingual entitlement", shell.includes("multilingual"));
assert("prefs provider gates locales", provider.includes("allowedLocales"));
assert(
  "provider ignores stored locale outside entitlement",
  provider.includes('allowedLocales.includes(storedLocale) ? storedLocale : "th"'),
);
assert("provider rejects setLocale outside entitlement", provider.includes("if (!allowedLocales.includes(next)) return;"));
assert("prefs controls render entitled locales only", prefs.includes("allowedLocales.map"));
assert("prefs hides switcher when Thai-only", prefs.includes("allowedLocales.length > 1"));
assert("nav no longer hardcodes TH·EN badge", nav.includes("allowedLocales.length > 1"));
assert("storefront passes multilingual to shell", storefront.includes("multilingual={props.multilingual}"));
assert("storefront uses white-label-aware branding", storefront.includes("resolveCustomerStorefrontBranding"));

// —— Back to store copy ——
assert("th back to store", th["booking.storeHome"] === "← กลับหน้าร้าน");
assert("en back to store", en["booking.storeHome"] === "← Back to store");
assert("zh back to store", zh["booking.storeHome"] === "← 返回店铺");

const globals = read("src/app/globals.css");
assert("customer dark tokens", globals.includes("customer-dark") && globals.includes("--cx-surface"));
assert("cx text-muted mapping", globals.includes(".customer-cx .text-muted") || globals.includes("customer-theme-tokens .text-muted"));
assert("reduced motion retained", globals.includes("prefers-reduced-motion"));
assert("accent ink token exists", globals.includes("--cx-onAccent"));
assert("accent CTA keeps dark ink", globals.includes(".cx-accent-cta"));
assert(
  "dark ink remap no longer hits accent CTAs",
  !globals.includes(".customer-theme-tokens .text-navy-950"),
);
assert("no !important spam in cx tokens", globals.split("!important").length - 1 <= 4);

const storeLogin = read("src/app/store/login/page.tsx");
assert("store login remains separate", storeLogin.length > 40);

const authSheet = read("src/components/storefront/BookingAuthSheet.tsx");
assert("BookingAuthSheet no Powered by KubHai", !authSheet.includes("Powered by KubHai"));

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll customer-cx checks passed");
