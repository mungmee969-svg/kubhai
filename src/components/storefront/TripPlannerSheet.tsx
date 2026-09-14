"use client";

import { useMemo, useState } from "react";
import { PLACE_CATEGORY_LABELS, type PlaceCategory } from "@/lib/domain/enums";
import type { Place } from "@/lib/domain/types";

const PLANNER_CATEGORIES: PlaceCategory[] = [
  "ATTRACTION",
  "LOCAL_FOOD",
  "RESTAURANT",
  "CAFE",
  "HOTEL",
  "ACTIVITY",
  "SOUVENIR",
];

type Props = {
  places: Place[];
  selectedIds: string[];
  letStorePlan: boolean;
  onClose: () => void;
  onChange: (placeIds: string[], letStorePlan: boolean) => void;
};

export function TripPlannerSheet({
  places,
  selectedIds,
  letStorePlan,
  onClose,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "ALL">("ALL");
  const [localIds, setLocalIds] = useState(selectedIds);
  const [localPlan, setLocalPlan] = useState(letStorePlan);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((place) => {
      if (category !== "ALL" && place.category !== category) return false;
      if (!q) return true;
      return place.name.toLowerCase().includes(q) || (place.description ?? "").toLowerCase().includes(q);
    });
  }, [places, query, category]);

  function toggle(id: string) {
    setLocalIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function save() {
    onChange(localIds, localPlan);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-[color:var(--store-ink,#0F1724)]/40" onClick={onClose} aria-label="ปิด" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-[color:var(--store-paper,#F7F4EF)] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:max-w-lg md:rounded-none">
        <div className="flex items-center justify-between border-b border-[color:var(--store-line,#E8E2D8)] px-5 py-4">
          <div>
            <p className="text-xs text-muted">ไม่บังคับ</p>
            <h2 className="text-lg font-semibold">วางแผนทริป / จุดแวะ</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted">
            ปิด
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="flex items-start gap-3 rounded-2xl bg-white p-4">
            <input
              type="checkbox"
              checked={localPlan}
              onChange={(e) => setLocalPlan(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold">ให้ร้านช่วยจัดทริป</span>
              <span className="text-xs text-muted">ร้านจะช่วยจัดเส้นทางตามจำนวนวันและสไตล์การเดินทาง</span>
            </span>
          </label>

          <input
            className="wizard-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาสถานที่"
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip active={category === "ALL"} onClick={() => setCategory("ALL")} label="ทั้งหมด" />
            {PLANNER_CATEGORIES.map((item) => (
              <Chip
                key={item}
                active={category === item}
                onClick={() => setCategory(item)}
                label={PLACE_CATEGORY_LABELS[item]}
              />
            ))}
          </div>

          {localIds.length ? (
            <div className="rounded-2xl bg-white p-3">
              <p className="mb-2 text-xs font-medium text-muted">จุดในทริป ({localIds.length})</p>
              <ul className="space-y-2">
                {localIds.map((id, index) => {
                  const place = places.find((item) => item.id === id);
                  if (!place) return null;
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {index + 1}. {cleanPlaceName(place.name)}
                      </span>
                      <button type="button" className="text-xs text-danger" onClick={() => toggle(id)}>
                        ลบ
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <ul className="space-y-2">
            {filtered.map((place) => {
              const selected = localIds.includes(place.id);
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => toggle(place.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left ${
                      selected ? "bg-[color:var(--store-primary,#0F3D3E)] text-white" : "bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold">{cleanPlaceName(place.name)}</p>
                    {place.description ? (
                      <p className={`mt-1 text-xs ${selected ? "text-white/75" : "text-muted"}`}>
                        {cleanPlaceName(place.description)}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-[color:var(--store-line,#E8E2D8)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={save}
            className="h-12 w-full rounded-2xl bg-[color:var(--store-accent,#C4A35A)] text-sm font-semibold text-[#1a1510]"
          >
            บันทึกจุดแวะ
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
        active ? "bg-[color:var(--store-primary,#0F3D3E)] text-white" : "bg-white text-[color:var(--store-ink,#0F1724)]"
      }`}
    >
      {label}
    </button>
  );
}

function cleanPlaceName(value: string) {
  return value
    .replace(/\s*\(ตัวอย่าง\)\s*/g, "")
    .replace(/ข้อมูลตัวอย่าง[^.]*\.?/g, "")
    .replace(/สำหรับทดสอบ[^.]*\.?/g, "")
    .replace(/ไม่ใช่ร้านจริง/g, "")
    .trim();
}
