/**
 * Local travel discovery + root content checks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LocalStore } from "../src/lib/data/local-store";
import { addPlaceToBookingDraft, emptyBookingDraft, readBookingDraft, writeBookingDraft, clearBookingDraft } from "../src/lib/booking/draft";
import {
  filterDiscoveryPlaces,
  groupDiscoveryRails,
  placeCoverUrl,
  RECOMMENDED_PERIODS,
} from "../src/lib/domain/discovery";
import { SEED } from "../src/lib/data/seed-ids";

const root = join(__dirname, "..");
let failed = 0;

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const FORBIDDEN = [
  "PILOT",
  "Pilot",
  "Partner Store #001",
  "Store #001",
  "ยังไม่เปิด Marketplace",
  "ร้านพาร์ทเนอร์นำร่อง",
  "ร้านนำร่อง",
  "ไม่ใช่เจ้าของโดเมน",
  "Pilot region",
  "Pilot province",
];

async function main() {
  const landing = read("src/components/marketing/KubHaiLanding.tsx");
  const home = read("src/app/page.tsx");
  const surface = `${landing}\n${home}`;

  assert("hero headline", landing.includes("เที่ยวเหนือ ไปกับขับให้"));
  assert("discovery prompt", landing.includes("ค้นหาแรงบันดาลใจ") || landing.includes("วันนี้อยากไปไหน?"));
  assert("transport partners section", landing.includes("พาร์ทเนอร์เดินทาง"));
  assert("local discovery section", landing.includes("HomeDiscovery") || landing.includes("แนะนำในเชียงใหม่"));
  assert("store login secondary", landing.includes("/store/login") && (landing.includes("สำหรับพาร์ทเนอร์") || landing.includes("สำหรับร้านค้า")));
  for (const phrase of FORBIDDEN) {
    assert(`no public copy: ${phrase}`, !surface.includes(phrase));
  }
  assert("no ตัวอย่าง in landing", !landing.includes("ตัวอย่าง"));

  const store = new LocalStore();
  const places = await store.listPublicPlaces({ provinceSlug: "chiang-mai" });
  assert("public places load", places.length >= 8);
  assert(
    "platform places exist",
    places.some((item) => item.businessId === null),
  );
  assert(
    "no ตัวอย่าง names in public places",
    places.every((item) => !item.name.includes("ตัวอย่าง")),
  );
  assert(
    "recommendedPeriods present",
    places.every((item) => Array.isArray(item.recommendedPeriods) && item.recommendedPeriods.length > 0),
  );
  assert(
    "DAY filter works",
    filterDiscoveryPlaces(places, { period: "DAY", provinceId: SEED.provinceChiangMai }).length > 0,
  );
  assert(
    "NIGHT filter works",
    filterDiscoveryPlaces(places, { period: "NIGHT", provinceId: SEED.provinceChiangMai }).length > 0,
  );
  assert(
    "restaurant category works",
    filterDiscoveryPlaces(places, { category: "RESTAURANT", provinceId: SEED.provinceChiangMai }).length > 0,
  );
  assert(
    "cafe category works",
    filterDiscoveryPlaces(places, { category: "CAFE", provinceId: SEED.provinceChiangMai }).length > 0,
  );
  assert(
    "hotel category works",
    filterDiscoveryPlaces(places, { category: "HOTEL", provinceId: SEED.provinceChiangMai }).length > 0,
  );

  const doi = await store.getPublicPlaceBySlug("doi-suthep");
  assert("place detail by slug", Boolean(doi?.place) && doi!.place.name === "ดอยสุเทพ");
  assert("place cover available", Boolean(placeCoverUrl(doi!.place)) && !placeCoverUrl(doi!.place).includes("/fleet/"));
  assert("opening hours not fabricated on doi", doi!.place.openingHours == null);
  assert("no fake rating fields", !("rating" in (doi!.place as object)));

  assert(
    "no fabricated sponsored public places",
    places.every((item) => !item.sponsored),
  );
  assert(
    "sponsored UI gated on data",
    read("src/components/discovery/PlaceCard.tsx").includes("place.sponsored"),
  );

  const rails = groupDiscoveryRails(places, SEED.provinceChiangMai);
  assert("rails day", rails.day.length > 0);
  assert("rails night", rails.night.length > 0);

  // add-to-trip uses existing draft DayPlan (jsdom-less: mock sessionStorage)
  const memory = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    },
  };

  clearBookingDraft("pondcarrent");
  writeBookingDraft("pondcarrent", emptyBookingDraft({ serviceType: "MULTI_DAY_TRIP", numberOfDays: 3, startDate: "2026-10-01" }));
  const hotel = places.find((item) => item.category === "HOTEL")!;
  addPlaceToBookingDraft("pondcarrent", hotel, { dayNumber: 1, asHotelEnd: true, preferredPeriod: "เย็น" });
  addPlaceToBookingDraft("pondcarrent", doi!.place, { dayNumber: 1, preferredPeriod: "กลางวัน" });
  const draft = readBookingDraft("pondcarrent")!;
  assert("multi-day draft days exist", draft.days.length >= 2);
  assert(
    "attraction added as stop",
    draft.days[0].stops.some((item) => item.placeId === doi!.place.id),
  );
  assert(
    "hotel as end of day",
    draft.days[0].endLocation?.placeId === hotel.id,
  );
  assert("single itinerary source (draft)", Boolean(draft.version === 4));
  clearBookingDraft("pondcarrent");

  const pond = await store.getPublicStore("pondcarrent");
  const demo = await store.getPublicStore("demo-store-002");
  assert("POND storefront intact", pond?.business.slug === "pondcarrent");
  assert("Store #002 intact", demo?.business.slug === "demo-store-002");
  assert(
    "POND does not own platform places",
    places.filter((item) => item.businessId === null).every((item) => item.businessId !== SEED.businessPond),
  );

  for (const period of RECOMMENDED_PERIODS) {
    assert(`period enum ${period}`, typeof period === "string");
  }

  if (failed) {
    console.error(`\ndiscovery-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\ndiscovery-check: ALL PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
