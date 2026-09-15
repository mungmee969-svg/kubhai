import {
  localStore,
  purgeTestAgentPlaces,
  restoreHomepageWorkspaceForTests,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import type { PlaceInput } from "../src/lib/data/repository";
import type { Actor, Place } from "../src/lib/domain/types";

const PREFIX = "TEST_AGENT_RECOMMENDATION_";
let failed = 0;

function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const ownerA: Actor = {
  kind: "user",
  userId: SEED.userPondOwner,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessPond],
};
const ownerB: Actor = {
  kind: "user",
  userId: SEED.userDemo002,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessDemo002],
};
const platformAdmin: Actor = {
  kind: "user",
  userId: SEED.userSuper,
  role: "SUPER_ADMIN",
  businessIds: [],
};

function inputFromPlace(place: Place, overrides: Partial<PlaceInput> = {}): PlaceInput {
  return {
    id: place.id,
    category: place.category,
    name: place.name,
    shortDescription: place.shortDescription,
    description: place.description,
    address: place.address,
    area: place.area,
    latitude: place.latitude,
    longitude: place.longitude,
    googlePlaceId: place.googlePlaceId,
    imageUrls: place.imageUrls,
    coverImageUrl: place.coverImageUrl,
    localRecommended: place.localRecommended,
    estimatedDurationMinutes: place.estimatedDurationMinutes,
    status: place.status,
    ...overrides,
  };
}

async function main() {
  await purgeTestAgentPlaces(PREFIX);
  const homepageBefore = await localStore.getHomepageWorkspace(platformAdmin);
  const platformPlacesBefore = await localStore.listPublicPlaces({
    provinceSlug: "chiang-mai",
  });
  const existingPlatformPlace = platformPlacesBefore.find(
    (place) => place.sourceType === "PLATFORM",
  );

  try {
    const created = await localStore.upsertPlace(ownerA, SEED.businessPond, {
      category: "CAFE",
      name: `${PREFIX}CAFE`,
      shortDescription: "คาเฟ่ท้องถิ่นที่ร้านแนะนำ",
      description: "ข้อมูลทดสอบ moderation",
      address: "เชียงใหม่",
      area: "เมืองเก่า",
      latitude: 18.7883,
      longitude: 98.9853,
      googlePlaceId: "test-agent-place",
      imageUrls: ["/home/category-cafe.jpg"],
      coverImageUrl: "/home/category-cafe.jpg",
      localRecommended: true,
      estimatedDurationMinutes: 60,
      status: "ACTIVE",
    });
    assert("Store A creates one authoritative Agent Place", created.sourceType === "AGENT");
    assert("new Agent Place starts not submitted", created.platformModerationStatus === "NOT_SUBMITTED");

    const storefrontA = await localStore.getPublicStore("pondcarrent");
    const storefrontB = await localStore.getPublicStore("demo-store-002");
    assert(
      "Store A published Place appears on own storefront data",
      storefrontA?.places.some((place) => place.id === created.id),
    );
    assert(
      "Store A Place does not appear on Store B storefront",
      !storefrontB?.places.some((place) => place.id === created.id),
    );
    assert(
      "not-submitted Place is absent from KubHai discovery",
      !(await localStore.listPublicPlaces()).some((place) => place.id === created.id),
    );

    const pending = await localStore.submitPlaceForPlatform(ownerA, created.id);
    assert("Store submits Place for KubHai review", pending.platformModerationStatus === "PENDING_REVIEW");
    assert(
      "pending Place remains absent from KubHai discovery",
      !(await localStore.listPublicPlaces()).some((place) => place.id === created.id),
    );
    assert(
      "Platform Admin sees pending submission",
      (await localStore.listPlatformPlaceSubmissions(platformAdmin, "PENDING_REVIEW")).some(
        (place) => place.id === created.id,
      ),
    );

    let storeReviewBlocked = false;
    try {
      await localStore.reviewPlatformPlace(ownerA, created.id, {
        decision: "APPROVE",
      });
    } catch {
      storeReviewBlocked = true;
    }
    assert("Store user cannot approve Platform content", storeReviewBlocked);

    const rejected = await localStore.reviewPlatformPlace(platformAdmin, created.id, {
      decision: "REJECT",
      reason: "รายละเอียดสถานที่ยังไม่ชัดเจน",
    });
    assert(
      "Platform rejection retains reason",
      rejected.platformModerationStatus === "REJECTED" &&
        rejected.platformRejectionReason === "รายละเอียดสถานที่ยังไม่ชัดเจน",
    );
    const resubmitted = await localStore.submitPlaceForPlatform(ownerA, created.id);
    assert("rejected Place can be resubmitted", resubmitted.platformModerationStatus === "PENDING_REVIEW");

    const approved = await localStore.reviewPlatformPlace(platformAdmin, created.id, {
      decision: "APPROVE",
    });
    assert("Platform approval makes Place eligible", approved.platformModerationStatus === "APPROVED");
    const discoveryPlace = (await localStore.listPublicPlaces()).find(
      (place) => place.id === created.id,
    );
    assert("approved Agent Place enters KubHai discovery", discoveryPlace?.id === created.id);
    assert(
      "KubHai discovery uses the same Place record",
      (await localStore.getPublicPlaceBySlug(created.slug))?.place.id === created.id,
    );
    assert(
      "approval alone does not force homepage selection",
      !homepageBefore.published.recommended.placeIds.includes(created.id),
    );

    const homepageDraft = structuredClone(homepageBefore.published);
    homepageDraft.recommended.useAutomaticSelection = false;
    homepageDraft.recommended.placeIds = [created.id];
    await localStore.saveHomepageDraft(platformAdmin, homepageDraft);
    assert(
      "approved Agent Place is accepted by Homepage CMS",
      (await localStore.getHomepageWorkspace(platformAdmin)).draft.recommended.placeIds[0] === created.id,
    );
    await localStore.publishHomepageDraft(platformAdmin);
    assert(
      "Platform selection publishes Place id to homepage",
      (await localStore.getPublishedHomepageConfig()).recommended.placeIds[0] === created.id,
    );
    const sourceStore = (await localStore.listPublicStores([created.businessId!]))[0];
    assert(
      "Agent attribution resolves to correct storefront",
      sourceStore?.business.slug === "pondcarrent",
    );

    let crossTenantBlocked = false;
    try {
      await localStore.upsertPlace(
        ownerB,
        SEED.businessPond,
        inputFromPlace(approved, { name: `${PREFIX}HIJACK` }),
      );
    } catch {
      crossTenantBlocked = true;
    }
    assert("cross-tenant Place mutation is rejected", crossTenantBlocked);

    const edited = await localStore.upsertPlace(
      ownerA,
      SEED.businessPond,
      inputFromPlace(approved, { name: `${PREFIX}UPDATED` }),
    );
    assert(
      "material Agent edit invalidates Platform approval",
      edited.platformModerationStatus === "NOT_SUBMITTED",
    );
    assert(
      "material edit can remain on Store storefront",
      (await localStore.getPublicStore("pondcarrent"))?.places.some(
        (place) => place.id === edited.id,
      ),
    );
    assert(
      "material edit leaves KubHai discovery",
      !(await localStore.listPublicPlaces()).some((place) => place.id === edited.id),
    );
    assert(
      "existing Platform Place remains discoverable",
      existingPlatformPlace &&
        (await localStore.listPublicPlaces()).some(
          (place) => place.id === existingPlatformPlace.id,
        ),
    );
  } finally {
    await restoreHomepageWorkspaceForTests(homepageBefore);
    if (!process.env.KEEP_AGENT_PLACE_FIXTURE) {
      await purgeTestAgentPlaces(PREFIX);
    }
  }

  if (failed) {
    console.error(`\nagent-place-moderation-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nagent-place-moderation-check: all passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
