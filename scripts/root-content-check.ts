/**
 * Root consumer content gate — complements discovery-check.
 * Ensures public "/" is KubHai travel marketing, not internal/pilot copy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const landing = readFileSync(join(root, "src/components/marketing/KubHaiLanding.tsx"), "utf8");
const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");

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
assert("hero headline", landing.includes("เที่ยวเหนือ ไปกับขับให้"));
assert("supporting copy", landing.includes("ค้นหาที่เที่ยว ร้านอาหาร คาเฟ่ ที่พัก"));
assert("discovery prompt", landing.includes("ค้นหาแรงบันดาลใจ"));
assert("transport partners section", landing.includes("พาร์ทเนอร์เดินทาง"));
assert("local discovery", landing.includes("แนะนำในเชียงใหม่") || landing.includes("HomeDiscovery"));
assert("customer login primary", landing.includes("เข้าสู่ระบบ") && landing.includes("/account"));
assert("store CTA secondary", (landing.includes("สำหรับพาร์ทเนอร์") || landing.includes("สำหรับร้านค้า")) && landing.includes("/store/login"));
assert("travel imagery", landing.includes("DISCOVERY_HERO_IMAGE") || landing.includes("/discovery/"));
assert("not car-company only", landing.includes("เที่ยว • กิน • ช้อป • พัก • เดินทาง"));

for (const phrase of forbidden) {
  assert(`no public copy: ${phrase}`, !landing.includes(phrase));
}

if (process.exitCode) {
  console.error("\nroot-content-check: FAILED");
  process.exit(1);
}
console.log("\nroot-content-check: ALL PASS");
