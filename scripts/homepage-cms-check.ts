import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import {
  localStore,
  restoreHomepageWorkspaceForTests,
} from "../src/lib/data/local-store";
import { SEED } from "../src/lib/data/seed-ids";
import { encodeSession, SESSION_COOKIE } from "../src/lib/auth/session";
import type { Actor } from "../src/lib/domain/types";
import { proxy } from "../src/proxy";

let failed = 0;
function assert(name: string, condition: unknown) {
  if (condition) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const root = join(__dirname, "..");
const landingSource = readFileSync(
  join(root, "src/components/marketing/KubHaiLanding.tsx"),
  "utf8",
);
const loginActionSource = readFileSync(join(root, "src/lib/actions/auth.ts"), "utf8");
const previewSource = readFileSync(
  join(root, "src/app/admin/website/preview/page.tsx"),
  "utf8",
);

const superActor: Actor = {
  kind: "user",
  userId: SEED.userSuper,
  role: "SUPER_ADMIN",
  businessIds: [],
};
const storeOwner: Actor = {
  kind: "user",
  userId: SEED.userPondOwner,
  role: "BUSINESS_OWNER",
  businessIds: [SEED.businessPond],
};

async function main() {
  const original = await localStore.getHomepageWorkspace(superActor);
  const places = await localStore.listPublicPlaces({ provinceSlug: "chiang-mai" });
  const publicStores = await localStore.listPublicStores([SEED.businessPond]);

  let ownerBlocked = false;
  try {
    await localStore.getHomepageWorkspace(storeOwner);
  } catch {
    ownerBlocked = true;
  }
  assert("Store Owner cannot read Platform homepage CMS", ownerBlocked);
  const ownerToken = encodeSession({
    userId: SEED.userPondOwner,
    email: "owner@pondcarrent.local",
    role: "BUSINESS_OWNER",
    businessIds: [SEED.businessPond],
    exp: Date.now() + 60_000,
  });
  const ownerAdminResponse = proxy(
    new NextRequest("http://localhost/admin/website", {
      headers: { cookie: `${SESSION_COOKIE}=${ownerToken}` },
    }),
  );
  assert(
    "Store Owner direct admin route redirects to Store",
    ownerAdminResponse.headers.get("location") === "http://localhost/store",
  );
  const superToken = encodeSession({
    userId: SEED.userSuper,
    email: "superadmin@kubhai.local",
    role: "SUPER_ADMIN",
    businessIds: [],
    exp: Date.now() + 60_000,
  });
  const superAdminResponse = proxy(
    new NextRequest("http://localhost/admin/website", {
      headers: { cookie: `${SESSION_COOKIE}=${superToken}` },
    }),
  );
  assert(
    "Platform Owner direct admin route is allowed",
    !superAdminResponse.headers.get("location"),
  );

  const marker = `CMS draft ${Date.now()}`;
  const testDraft = structuredClone(original.published);
  testDraft.hero.eyebrow = marker;
  testDraft.recommended.useAutomaticSelection = false;
  testDraft.recommended.placeIds = places[0] ? [places[0].id] : [];
  testDraft.agents.useAutomaticSelection = false;
  testDraft.agents.businessIds = publicStores[0] ? [publicStores[0].business.id] : [];

  try {
    const saved = await localStore.saveHomepageDraft(superActor, testDraft);
    const publicBeforePublish = await localStore.getPublishedHomepageConfig();
    assert("Save Draft marks unpublished changes", saved.hasUnpublishedChanges);
    assert(
      "Save Draft does not change public homepage",
      publicBeforePublish.hero.eyebrow === original.published.hero.eyebrow,
    );
    assert(
      "Draft references authoritative Place id",
      saved.draft.recommended.placeIds[0] === places[0]?.id,
    );
    assert(
      "Draft references authoritative Agent id",
      saved.draft.agents.businessIds[0] === publicStores[0]?.business.id,
    );

    await localStore.publishHomepageDraft(superActor);
    const publicAfterPublish = await localStore.getPublishedHomepageConfig();
    assert("Publish updates public homepage config", publicAfterPublish.hero.eyebrow === marker);
    assert(
      "Featured Agent resolves to existing storefront",
      publicStores[0]?.business.slug === "pondcarrent",
    );
  } finally {
    await restoreHomepageWorkspaceForTests(original);
  }

  assert(
    "Search card participates in document flow",
    landingSource.includes("relative z-20 mx-auto -mt-16") &&
      !landingSource.includes("absolute inset-x-5 bottom-0"),
  );
  assert(
    "Mobile search controls stack before desktop breakpoint",
    landingSource.includes('className="grid gap-3 md:grid-cols-[1fr_180px_auto]'),
  );
  assert(
    "same staff login routes by authoritative role",
    loginActionSource.includes('auth.profile.role === "SUPER_ADMIN"') &&
      loginActionSource.includes('redirect("/admin")') &&
      loginActionSource.includes('redirect("/store")'),
  );
  assert(
    "Draft preview is server-authorized",
    previewSource.includes("requirePlatformAdmin()") &&
      previewSource.includes("workspace.draft"),
  );

  if (failed) {
    console.error(`\nhomepage-cms-check: ${failed} failed`);
    process.exit(1);
  }
  console.log("\nhomepage-cms-check: all passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
