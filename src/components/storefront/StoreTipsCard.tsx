"use client";

import { useMemo, useState } from "react";
import { isMultiDayService, matchStoreTips } from "@/lib/domain/store-tips";
import type { ServiceType } from "@/lib/domain/enums";
import type { StoreTip } from "@/lib/domain/types";

export function StoreTipsCard({
  storeName,
  tips,
  serviceType,
  pickupLocation,
  dropoffLocation,
  passengerCount,
  luggageCount,
  multiDay,
  surface = "WIZARD",
  compact = false,
}: {
  storeName: string;
  tips: StoreTip[];
  serviceType?: ServiceType | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  passengerCount?: number | null;
  luggageCount?: number | null;
  multiDay?: boolean;
  surface?: "WIZARD" | "DETAIL" | "QUOTATION";
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const matched = useMemo(
    () =>
      matchStoreTips(
        tips,
        {
          serviceType,
          pickupLocation,
          dropoffLocation,
          passengerCount,
          luggageCount,
          multiDay: multiDay ?? isMultiDayService(serviceType),
          surface,
        },
        expanded ? 6 : 3,
      ),
    [
      tips,
      serviceType,
      pickupLocation,
      dropoffLocation,
      passengerCount,
      luggageCount,
      multiDay,
      surface,
      expanded,
    ],
  );

  if (!matched.length) return null;

  const visible = expanded ? matched : matched.slice(0, Math.min(3, matched.length));
  const canExpand = matched.length > 1 || tips.filter((t) => t.active).length > visible.length;

  return (
    <section
      className={`rounded-2xl border border-[color:var(--store-primary,#0F3D3E)]/10 bg-[color:var(--store-paper,#F7F3EA)]/80 ${
        compact ? "p-3" : "p-4"
      }`}
      aria-label={`คำแนะนำจาก ${storeName}`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-base" aria-hidden>
          ✦
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]">
            คำแนะนำจาก {storeName}
          </p>
          <ul className="mt-2 space-y-2">
            {visible.map((tip) => (
              <li key={tip.id} className="text-sm leading-snug text-navy-800">
                <span className="font-medium">{tip.title}</span>
                <span className="text-muted"> — </span>
                {tip.shortText}
              </li>
            ))}
          </ul>
          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-2 text-xs font-medium text-[color:var(--cx-brandFg,var(--store-primary,#0F3D3E))]"
            >
              {expanded ? "ย่อคำแนะนำ" : "ดูคำแนะนำเพิ่มเติม"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
