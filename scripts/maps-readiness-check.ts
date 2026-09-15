import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyBookingDraft } from "../src/lib/booking/draft";
import { buildBookingSubmitPayload } from "../src/lib/booking/submit";

const root = join(__dirname, "..");
let failed = 0;

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const googlePlaces = read("src/lib/location/google-places.ts");
const googleRoutes = read("src/lib/location/google-routes.ts");
const provider = read("src/lib/location/provider.ts");
const map = read("src/components/maps/LocationMapPreview.tsx");
const env = read(".env.example");
const bookingTokenPage = read("src/app/booking/[token]/page.tsx");
const adminBookingWorkspace = read(
  "src/components/store-admin/booking/BookingWorkspace.tsx",
);
const packageDetail = read("src/app/s/[slug]/packages/[packageId]/page.tsx");
const placeForm = read("src/components/store-admin/PlaceForm.tsx");

assert(
  "server and browser Maps credentials separated",
  googlePlaces.includes("GOOGLE_MAPS_API_KEY") &&
    !googlePlaces.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"),
);
assert(
  "Places search has no store/province hardcode",
  !googlePlaces.includes("18.7883") && !googlePlaces.includes("Chiang Mai"),
);
assert(
  "existing local/manual fallback retained",
  provider.includes("falls back") && provider.includes("localLocationProvider"),
);
assert(
  "map has truthful unconfigured state",
  map.includes("Google Maps ยังไม่ได้ตั้งค่า") &&
    map.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"),
);
assert(
  "customer and Store Admin reuse map preview",
  bookingTokenPage.includes("LocationMapPreview") &&
    adminBookingWorkspace.includes("LocationMapPreview") &&
    packageDetail.includes("LocationMapPreview"),
);
assert(
  "Place CMS preserves Google place id while editing",
  placeForm.includes("place?.googlePlaceId ?? null"),
);
assert(
  "Routes boundary is server credential based",
  googleRoutes.includes("GOOGLE_ROUTES_API_KEY") &&
    googleRoutes.includes("routes.googleapis.com"),
);
assert(
  "Routes boundary cannot mutate commercial state",
  !googleRoutes.includes('from "@/lib/domain/quotation"') &&
    !googleRoutes.includes('from "@/lib/domain/settlement"') &&
    !googleRoutes.includes('from "@/lib/data"'),
);
assert(
  "env documents restricted separate credentials",
  env.includes("GOOGLE_MAPS_API_KEY=") &&
    env.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=") &&
    env.includes("GOOGLE_ROUTES_API_KEY=") &&
    env.includes("HTTP referrers"),
);

const draft = emptyBookingDraft({
  serviceType: "AIRPORT_TRANSFER",
  pickup: {
    label: "Structured pickup",
    address: "1 Test Road",
    latitude: 18.78,
    longitude: 98.98,
    placeId: "google-place-1",
    placeType: "establishment",
    customerNote: null,
    source: "SEARCH",
  },
  dropoff: {
    label: "Manual destination",
    address: null,
    latitude: null,
    longitude: null,
    placeId: null,
    placeType: null,
    customerNote: null,
    source: "MANUAL",
  },
  startDate: "2030-01-01",
  name: "Maps Test",
  phone: "0812345678",
});
const built = buildBookingSubmitPayload("maps-readiness", draft, "DIRECT");
assert(
  "structured Google address persists to submit payload",
  built.ok &&
    built.payload.pickupPlaceId === "google-place-1" &&
    built.payload.pickupLat === 18.78 &&
    built.payload.pickupLng === 98.98,
);
assert(
  "manual address fallback still submits",
  built.ok &&
    built.payload.dropoffSource === "MANUAL" &&
    built.payload.dropoffPlaceId === null,
);

if (failed) {
  console.error(`\nmaps-readiness-check: ${failed} failed`);
  process.exit(1);
}
console.log("\nmaps-readiness-check: all passed");
