import { persistLegacyMovementBackfill, purgeIdentifiedFixtures } from "../src/lib/data/local-store";

async function main() {
  const backfill = await persistLegacyMovementBackfill();
  const removed = await purgeIdentifiedFixtures();
  console.log(JSON.stringify({ backfill, removed }, null, 2));
}

void main();
