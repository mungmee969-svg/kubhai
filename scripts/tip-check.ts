/**
 * Store tips / local recommendations — matching, isolation, booking-specific tips,
 * no booking blockage, no price mutation.
 */
import { LocalStore, purgeByClientRequestPrefix } from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { isMultiDayService, matchStoreTips } from "../src/lib/domain/store-tips";
import { settleBooking } from "../src/lib/domain/settlement";
import type { Actor, StoreTip } from "../src/lib/domain/types";

const store = new LocalStore();
const PREFIX = "TEST_TIPS_";
let failed = 0;

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const pondOwner: Actor = {
  kind: "user",
  userId: SEED.userPondOwner,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessPond],
};

const demoOwner: Actor = {
  kind: "user",
  userId: SEED.userDemo002,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessDemo002],
};

const pondTips: StoreTip[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
    title: "ทั่วไป",
    shortText: "แจ้งจำนวนผู้โดยสารให้ครบ",
    serviceType: null,
    placeId: null,
    locationKeyword: null,
    category: null,
    minPassengers: null,
    minLuggage: null,
    multiDayOnly: false,
    active: true,
    priority: 10,
    surfaces: ["WIZARD"],
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
    title: "สนามบิน",
    shortText: "เผื่อเวลาเช็กอิน 2 ชม.",
    serviceType: "AIRPORT_TRANSFER",
    placeId: null,
    locationKeyword: null,
    category: null,
    minPassengers: null,
    minLuggage: null,
    multiDayOnly: false,
    active: true,
    priority: 90,
    surfaces: ["WIZARD", "DETAIL"],
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
    title: "ดอยสุเทพ",
    shortText: "แนะนำออกก่อน 08:00",
    serviceType: null,
    placeId: null,
    locationKeyword: "ดอยสุเทพ",
    category: null,
    minPassengers: null,
    minLuggage: null,
    multiDayOnly: false,
    active: true,
    priority: 80,
    surfaces: ["WIZARD"],
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04",
    title: "หลายวัน",
    shortText: "ร้านช่วยจัดแผนรายวันให้ได้",
    serviceType: null,
    placeId: null,
    locationKeyword: null,
    category: null,
    minPassengers: null,
    minLuggage: null,
    multiDayOnly: true,
    active: true,
    priority: 60,
    surfaces: ["WIZARD"],
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05",
    title: "ปิดแล้ว",
    shortText: "ไม่ควรเห็น",
    serviceType: null,
    placeId: null,
    locationKeyword: null,
    category: null,
    minPassengers: null,
    minLuggage: null,
    multiDayOnly: false,
    active: false,
    priority: 100,
    surfaces: ["WIZARD"],
  },
];

async function main() {
  try {
    await purgeByClientRequestPrefix(PREFIX);

    await store.updateSettings(pondOwner, SEED.businessPond, { tips: pondTips });
    await store.updateSettings(demoOwner, SEED.businessDemo002, {
      tips: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
          title: "Demo tip",
          shortText: "เฉพาะ Store #002",
          serviceType: null,
          placeId: null,
          locationKeyword: null,
          category: null,
          minPassengers: null,
          minLuggage: null,
          multiDayOnly: false,
          active: true,
          priority: 10,
          surfaces: ["WIZARD"],
        },
      ],
    });

    const pond = await store.getPublicStore("pondcarrent");
    const demo = await store.getPublicStore("demo-store-002");
    assert("POND tips saved", (pond?.settings?.tips.length ?? 0) >= 4);
    assert("demo tips isolated content", demo?.settings?.tips.some((t) => t.shortText.includes("002")));
    assert(
      "no POND tip leak into demo settings",
      !(demo?.settings?.tips ?? []).some((t) => t.shortText.includes("08:00")),
    );

    const general = matchStoreTips(pondTips, { serviceType: "PRIVATE_DRIVER_DAILY", surface: "WIZARD" }, 3);
    assert("general tip matches", general.some((t) => t.title === "ทั่วไป"));
    assert("disabled tip hidden", !general.some((t) => t.title === "ปิดแล้ว"));

    const airport = matchStoreTips(
      pondTips,
      { serviceType: "AIRPORT_TRANSFER", pickupLocation: "สนามบินเชียงใหม่", surface: "WIZARD" },
      3,
    );
    assert("service-specific tip", airport[0]?.title === "สนามบิน");

    const location = matchStoreTips(
      pondTips,
      { serviceType: "POINT_TO_POINT", dropoffLocation: "วัดพระธาตุดอยสุเทพ", surface: "WIZARD" },
      3,
    );
    assert("location-specific tip", location.some((t) => t.title === "ดอยสุเทพ"));

    const multi = matchStoreTips(
      pondTips,
      {
        serviceType: "MULTI_DAY_TRIP",
        multiDay: isMultiDayService("MULTI_DAY_TRIP"),
        surface: "WIZARD",
      },
      3,
    );
    assert("multi-day tip", multi.some((t) => t.title === "หลายวัน"));
    assert("limit 1–3", multi.length <= 3);

    const created = await store.createBookingRequest({
      businessSlug: "pondcarrent",
      clientRequestId: `${PREFIX}A`,
      customerName: "ลูกค้า tips",
      customerPhone: "0819990001",
      customerEmail: null,
      customerType: "PERSONAL",
      companyName: null,
      taxId: null,
      serviceType: "PRIVATE_DRIVER_DAILY",
      startDate: "2026-10-01",
      startTime: "09:00",
      endDate: null,
      endTime: null,
      passengerCount: 2,
      luggageCount: 1,
      pickupLocation: "นิมมาน",
      dropoffLocation: "ดอยสุเทพ",
      tripNotes: null,
      letStorePlanTrip: false,
      preferredVehicleId: null,
      placeIds: [],
      source: "DIRECT",
      sessionId: `${PREFIX}A`,
      referrer: null,
    });

    const beforeQuote = created.booking.quotedTotal;
    await store.addBookingNote(pondOwner, created.booking.id, "แนะนำออกเช้าเพราะช่วงบ่ายรถติด", {
      audience: "CUSTOMER",
      title: "คำแนะนำจากร้าน",
    });
    await store.addBookingNote(pondOwner, created.booking.id, "โน้ตภายในอย่างเดียว", {
      audience: "INTERNAL",
    });

    const detail = await store.getBookingById(pondOwner, created.booking.id);
    assert(
      "booking-specific customer tip saved",
      detail?.notes.some((n) => n.audience === "CUSTOMER" && n.body.includes("ออกเช้า")),
    );
    assert(
      "internal note separate",
      detail?.notes.some((n) => n.audience === "INTERNAL" && n.body.includes("ภายใน")),
    );
    assert("no price mutation from tip", detail?.booking.quotedTotal === beforeQuote);

    // Public record strips internal notes only
    const { publicBookingRecord } = await import("../src/lib/domain/public-view");
    const pub = publicBookingRecord(detail!);
    assert("public keeps customer tip", pub.notes.some((n) => n.audience === "CUSTOMER"));
    assert("public hides internal note", !pub.notes.some((n) => n.audience === "INTERNAL"));

    // Tenant isolation
    let blocked = false;
    try {
      await store.addBookingNote(demoOwner, created.booking.id, "ไม่ควรได้", { audience: "CUSTOMER" });
    } catch {
      blocked = true;
    }
    assert("Store #002 cannot tip POND booking", blocked);

    const settle = settleBooking(detail!.booking, detail!.movements);
    assert("tips do not create money", settle.customerPaidTotal === 0 && detail!.movements.length === 0);

    await purgeByClientRequestPrefix(PREFIX);
    console.log(failed ? `\nFAILED ${failed}` : "\ntip-check: ALL PASS");
    process.exit(failed ? 1 : 0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
