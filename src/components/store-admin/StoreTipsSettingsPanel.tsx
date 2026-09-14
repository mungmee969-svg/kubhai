"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveStoreTipsAction } from "@/lib/actions/ops";
import { PLACE_CATEGORIES, SERVICE_TYPES, SERVICE_TYPE_LABELS, type PlaceCategory, type ServiceType } from "@/lib/domain/enums";
import { STORE_TIP_SURFACES, type StoreTipSurface } from "@/lib/domain/store-tips";
import type { StoreTip } from "@/lib/domain/types";
import { Feedback } from "./ui/Feedback";

function emptyTip(): StoreTip {
  return {
    id: crypto.randomUUID(),
    title: "",
    shortText: "",
    serviceType: null,
    placeId: null,
    locationKeyword: null,
    category: null,
    minPassengers: null,
    minLuggage: null,
    multiDayOnly: false,
    active: true,
    priority: 50,
    surfaces: ["WIZARD"],
  };
}

const SURFACE_LABEL: Record<StoreTipSurface, string> = {
  WIZARD: "หน้าจอง",
  DETAIL: "รายละเอียดการจอง",
  QUOTATION: "ใบเสนอราคา",
};

export function StoreTipsSettingsPanel({
  businessId,
  initialTips,
}: {
  businessId: string;
  initialTips: StoreTip[];
}) {
  const router = useRouter();
  const [tips, setTips] = useState<StoreTip[]>(initialTips);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await saveStoreTipsAction(businessId, tips);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess("บันทึกคำแนะนำร้านแล้ว");
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5">
      <div>
        <h2 className="font-semibold text-navy-800">คำแนะนำร้าน</h2>
        <p className="mt-1 text-sm text-muted">
          ข้อความสั้น ๆ ที่ช่วยลูกค้า — ไม่ใช่โฆษณา และไม่บล็อกการจอง
        </p>
      </div>
      <Feedback error={error} success={success} />

      <div className="space-y-4">
        {tips.map((tip, index) => (
          <article key={tip.id} className="space-y-2 rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-navy-800">คำแนะนำ #{index + 1}</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={tip.active}
                  onChange={(e) =>
                    setTips((current) =>
                      current.map((item, i) => (i === index ? { ...item, active: e.target.checked } : item)),
                    )
                  }
                />
                เปิดใช้งาน
              </label>
            </div>
            <input
              className="admin-input"
              placeholder="หัวข้อสั้น"
              value={tip.title}
              onChange={(e) =>
                setTips((current) =>
                  current.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                )
              }
            />
            <textarea
              className="admin-input min-h-20 py-3"
              placeholder="ข้อความสั้น (ไม่ใส่ราคา/เวลาเปิดที่ยังไม่ยืนยัน)"
              value={tip.shortText}
              onChange={(e) =>
                setTips((current) =>
                  current.map((item, i) => (i === index ? { ...item, shortText: e.target.value } : item)),
                )
              }
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted">
                ประเภทบริการ (ถ้ามี)
                <select
                  className="admin-input mt-1"
                  value={tip.serviceType ?? ""}
                  onChange={(e) =>
                    setTips((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, serviceType: (e.target.value || null) as ServiceType | null }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="">ทุกบริการ</option>
                  {SERVICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SERVICE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                คำค้นสถานที่
                <input
                  className="admin-input mt-1"
                  placeholder="เช่น สนามบิน / ดอยสุเทพ"
                  value={tip.locationKeyword ?? ""}
                  onChange={(e) =>
                    setTips((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, locationKeyword: e.target.value || null } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="text-xs text-muted">
                หมวดสถานที่
                <select
                  className="admin-input mt-1"
                  value={tip.category ?? ""}
                  onChange={(e) =>
                    setTips((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, category: (e.target.value || null) as PlaceCategory | null }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="">ไม่ระบุ</option>
                  {PLACE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                ความสำคัญ (0–1000)
                <input
                  className="admin-input mt-1"
                  inputMode="numeric"
                  value={tip.priority}
                  onChange={(e) =>
                    setTips((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, priority: Number(e.target.value || 0) } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="text-xs text-muted">
                ผู้โดยสารอย่างน้อย
                <input
                  className="admin-input mt-1"
                  inputMode="numeric"
                  value={tip.minPassengers ?? ""}
                  onChange={(e) =>
                    setTips((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, minPassengers: e.target.value ? Number(e.target.value) : null }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="text-xs text-muted">
                กระเป๋าอย่างน้อย
                <input
                  className="admin-input mt-1"
                  inputMode="numeric"
                  value={tip.minLuggage ?? ""}
                  onChange={(e) =>
                    setTips((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, minLuggage: e.target.value ? Number(e.target.value) : null }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={tip.multiDayOnly}
                onChange={(e) =>
                  setTips((current) =>
                    current.map((item, i) => (i === index ? { ...item, multiDayOnly: e.target.checked } : item)),
                  )
                }
              />
              เฉพาะทริปหลายวัน
            </label>
            <div className="flex flex-wrap gap-3 text-xs">
              {STORE_TIP_SURFACES.map((surface) => (
                <label key={surface} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={tip.surfaces.includes(surface)}
                    onChange={(e) =>
                      setTips((current) =>
                        current.map((item, i) => {
                          if (i !== index) return item;
                          const surfaces = e.target.checked
                            ? [...item.surfaces, surface]
                            : item.surfaces.filter((value) => value !== surface);
                          return { ...item, surfaces };
                        }),
                      )
                    }
                  />
                  {SURFACE_LABEL[surface]}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="text-xs text-danger"
              onClick={() => setTips((current) => current.filter((_, i) => i !== index))}
            >
              ลบคำแนะนำนี้
            </button>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTips((current) => [...current, emptyTip()])}
          className="h-11 rounded-xl bg-paper px-4 text-sm"
        >
          + เพิ่มคำแนะนำ
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกคำแนะนำร้าน"}
        </button>
      </div>
    </section>
  );
}
