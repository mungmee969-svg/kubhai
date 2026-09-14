/**
 * Platform route + KubHai root marketing content checks.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LocalStore } from "../src/lib/data/local-store";
import { storefrontPath } from "../src/lib/domain/storefront-url";
import { BOOKING_STATUS_LABELS } from "../src/lib/domain/enums";

const root = join(__dirname, "..");
let failed = 0;

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

function pageExists(rel: string) {
  return existsSync(join(root, rel));
}

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const FORBIDDEN_CUSTOMER_COPY = [
  "PILOT",
  "Pilot",
  "Partner Store #001",
  "PARTNER STORE #001",
  "ยังไม่เปิด Marketplace",
  "ร้านพาร์ทเนอร์นำร่อง",
  "ไม่ใช่เจ้าของโดเมน",
  "Pilot region",
  "Pilot province",
  "discovery foundation",
  "Marketplace ยังไม่เปิด",
];

async function main() {
  assert("route / page", pageExists("src/app/page.tsx"));
  assert("route /services", pageExists("src/app/services/page.tsx"));
  assert("route /region/[slug]", pageExists("src/app/region/[slug]/page.tsx"));
  assert("route /province/[slug]", pageExists("src/app/province/[slug]/page.tsx"));
  assert("route /stores", pageExists("src/app/stores/page.tsx"));
  assert("route /s/[slug]", pageExists("src/app/s/[slug]/page.tsx") || pageExists("src/app/s/[storeSlug]/page.tsx"));
  assert("route /store/login", pageExists("src/app/store/login/page.tsx"));
  assert("route /store", pageExists("src/app/store/page.tsx"));
  assert("route /account", pageExists("src/app/account/page.tsx"));
  assert("route /booking/[token]", pageExists("src/app/booking/[token]/page.tsx"));

  assert("landing component exists", pageExists("src/components/marketing/KubHaiLanding.tsx"));

  const home = read("src/app/page.tsx");
  const landing = read("src/components/marketing/KubHaiLanding.tsx");
  const rootSurface = `${home}\n${landing}`;

  assert("root uses KubHaiLanding", home.includes("KubHaiLanding"));
  assert("KubHai identity in landing", landing.includes("KubHai") && landing.includes("ขับให้"));
  assert("hero headline present", landing.includes("เที่ยวเหนือ ไปกับขับให้"));
  assert("discovery prompt present", landing.includes("ค้นหาแรงบันดาลใจ"));
  assert("service discovery visible", landing.includes("รถพร้อมคนขับ") && landing.includes("ที่เที่ยว"));
  assert("featured store customer title", landing.includes("พาร์ทเนอร์เดินทาง"));
  assert("featured store CTA", landing.includes("ดูบริการ"));
  assert("POND card uses storefrontPath / slug", landing.includes("storefrontPath") || landing.includes("/s/"));
  assert("store login secondary only", landing.includes("/store/login") && (landing.includes("สำหรับพาร์ทเนอร์") || landing.includes("สำหรับร้านค้า")));
  assert("customer login separate", landing.includes("platformLoginHref") || landing.includes("/account/login"));
  assert("travel hero image slot", landing.includes("DISCOVERY_HERO_IMAGE") || landing.includes("/discovery/placeholders/hero-north"));
  assert("page is not LoginForm", !rootSurface.includes("LoginForm"));
  assert("places route exists", pageExists("src/app/places/[slug]/page.tsx"));
  assert("places index exists", pageExists("src/app/places/page.tsx"));
  assert("not car-only positioning", landing.includes("เที่ยว • กิน • ช้อป • พัก • เดินทาง"));
  assert("partner intermediary copy", landing.includes("ไม่ใช่รถของ KubHai เอง"));

  for (const phrase of FORBIDDEN_CUSTOMER_COPY) {
    assert(`no customer copy: ${phrase}`, !rootSurface.includes(phrase));
  }

  const loginLegacy = read("src/app/login/page.tsx");
  assert("legacy /login redirects to /store/login", loginLegacy.includes("/store/login"));

  const proxy = read("src/proxy.ts");
  assert("proxy allows /store/login without session", proxy.includes("/store/login"));
  assert("proxy redirects store auth to /store/login", proxy.includes('"/store/login'));
  assert("proxy customer auth uses platform context", proxy.includes("context=platform"));
  assert("login page never falls back to pondcarrent", !read("src/app/account/login/page.tsx").includes("pondcarrent"));
  assert("login page uses auth presentation resolver", read("src/app/account/login/page.tsx").includes("resolveCustomerAuthPresentation"));

  const store = new LocalStore();
  const pond = await store.getPublicStore("pondcarrent");
  const demo = await store.getPublicStore("demo-store-002");
  assert("POND storefront slug", storefrontPath(pond!.business.slug) === "/s/pondcarrent");
  assert("Store #002 storefront slug", storefrontPath(demo!.business.slug) === "/s/demo-store-002");
  assert(
    "storefronts isolated",
    storefrontPath(pond!.business.slug) !== storefrontPath(demo!.business.slug),
  );
  assert("root featured store resolves POND slug", pond!.business.slug === "pondcarrent");
  assert("Store #002 unaffected as separate tenant", demo!.business.slug === "demo-store-002");

  assert(
    "CUSTOMER_CONFIRMED label is post-acceptance",
    BOOKING_STATUS_LABELS.CUSTOMER_CONFIRMED === "ลูกค้ายืนยันแล้ว",
  );

  if (failed) {
    console.error(`\nplatform-route-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nplatform-route-check: ALL PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
