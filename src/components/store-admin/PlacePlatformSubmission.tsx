"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitPlaceForPlatformAction } from "@/lib/actions/ops";
import type { Place } from "@/lib/domain/types";

const STATUS_LABEL: Record<Place["platformModerationStatus"], string> = {
  NOT_SUBMITTED: "ยังไม่ได้เสนอ",
  PENDING_REVIEW: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่ผ่านการอนุมัติ",
};

export function PlacePlatformSubmission({ place }: { place: Place }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    place.platformModerationStatus === "NOT_SUBMITTED" ||
    place.platformModerationStatus === "REJECTED";

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await submitPlaceForPlatformAction(place.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 rounded-xl bg-paper px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="text-muted">ขับให้: </span>
          <span className="font-semibold text-navy-800">
            {STATUS_LABEL[place.platformModerationStatus]}
          </span>
        </p>
        {canSubmit ? (
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="rounded-lg bg-navy-800 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            {pending ? "กำลังส่ง..." : "เสนอขึ้นขับให้"}
          </button>
        ) : null}
      </div>
      {place.platformModerationStatus === "REJECTED" &&
      place.platformRejectionReason ? (
        <p className="mt-1 text-danger">เหตุผล: {place.platformRejectionReason}</p>
      ) : null}
      {canSubmit ? (
        <p className="mt-1.5 leading-relaxed text-muted">
          ส่งสถานที่นี้ให้ทีมขับให้ตรวจสอบ เพื่อมีโอกาสแสดงในหน้าค้นหาและพื้นที่แนะนำของขับให้
        </p>
      ) : null}
      {error ? <p className="mt-1 text-danger">{error}</p> : null}
    </div>
  );
}
