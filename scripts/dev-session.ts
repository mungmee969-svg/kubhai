import { encodeSession } from "../src/lib/auth/session";
import { SEED } from "../src/lib/data/seed-ids";

const who = process.argv[2] ?? "pond";
const payload =
  who === "super"
    ? {
        userId: SEED.userSuper,
        email: "superadmin@kubhai.local",
        role: "SUPER_ADMIN" as const,
        businessIds: [] as string[],
      }
    : who === "demo2"
      ? {
          userId: SEED.userDemo002,
          email: "owner@demo002.local",
          role: "BUSINESS_OWNER" as const,
          businessIds: [SEED.businessDemo002],
        }
      : {
          userId: SEED.userPondOwner,
          email: "owner@pondcarrent.local",
          role: "BUSINESS_OWNER" as const,
          businessIds: [SEED.businessPond],
        };

process.stdout.write(
  encodeSession({
    ...payload,
    exp: Date.now() + 1000 * 60 * 30,
  }),
);
