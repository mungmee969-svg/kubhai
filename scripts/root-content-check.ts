/**
 * Root consumer content gate — complements discovery-check.
 * Ensures public "/" is KubHai travel marketing, not internal/pilot copy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const landing = readFileSync(join(root, "src/components/marketing/KubHaiLanding.tsx"), "utf8");
const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");
const homepageConfig = readFileSync(join(root, "src/lib/domain/homepage-cms.ts"), "utf8");
const homepage = `${landing}\n${homepageConfig}`;

function assert(name: string, cond: boolean) {
  if (!cond) {
    console.error(`FAIL  ${name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS  ${name}`);
}

const forbidden = [
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
  "ตัวอย่าง",
];

assert("root uses KubHaiLanding", page.includes("KubHaiLanding"));
assert("approved Lanna hero headline", homepage.includes("ขับให้คุณค้นพบ") && homepage.includes("เสน่ห์แห่งล้านนา"));
assert("short discovery copy", homepage.includes("เที่ยว กิน พัก เดินทาง"));
assert("compact discovery prompt", homepage.includes("อยากไปไหน หรือกำลังหาอะไร?"));
assert("four primary categories", ["ที่เที่ยว", "ร้านอาหาร", "คาเฟ่", "รถเช่า / บริการรถ"].every((label) => homepage.includes(label)));
assert("transport partners section", homepage.includes("เดินทางต่อกับร้านรถที่เหมาะกับคุณ"));
assert("local discovery", homepage.includes("แนะนำในเชียงใหม่"));
assert(
  "customer login primary",
  landing.includes("เข้าสู่ระบบ") && landing.includes("platformLoginHref"),
);
assert(
  "partner cards retain storefront route",
  landing.includes("storefrontPath(store.slug)"),
);
assert("travel imagery uses replaceable local assets", landing.includes("/home/lanna-hero.jpg"));
assert("not car-company only", homepage.includes("เที่ยว กิน พัก เดินทาง"));

for (const phrase of forbidden) {
  assert(`no public copy: ${phrase}`, !homepage.includes(phrase));
}

if (process.exitCode) {
  console.error("\nroot-content-check: FAILED");
  process.exit(1);
}
console.log("\nroot-content-check: ALL PASS");
