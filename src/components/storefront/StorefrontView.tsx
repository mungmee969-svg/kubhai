import { Suspense } from "react";
import { PartnerStorefront } from "@/components/storefront/PartnerStorefront";
import type { BookingSource } from "@/lib/domain/enums";
import type { TripPackage } from "@/lib/domain/trip-package";
import type {
  Business,
  BusinessSettings,
  Place,
  Province,
  Region,
  Vehicle,
} from "@/lib/domain/types";

type Props = {
  slug: string;
  business: Business;
  settings: BusinessSettings | null;
  vehicles: Vehicle[];
  places: Place[];
  region: Region | null;
  province: Province | null;
  tripPackages?: TripPackage[];
  initialSource?: BookingSource;
  prefill?: { name?: string; phone?: string };
  loggedIn?: boolean;
  multilingual?: boolean;
};

export function StorefrontView(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#1a2e2e] text-sm text-white">
          กำลังเปิดร้าน...
        </div>
      }
    >
      <PartnerStorefront {...props} />
    </Suspense>
  );
}
