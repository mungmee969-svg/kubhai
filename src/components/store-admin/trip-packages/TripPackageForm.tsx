"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Feedback } from "@/components/store-admin/ui/Feedback";
import {
  TripPackageCard,
  buildTripPackageCardView,
  type TripPackageCardView,
} from "@/components/storefront/TripPackageCard";
import {
  archiveTripPackageAction,
  createTripPackageAction,
  publishTripPackageAction,
  setTripPackageStatusAction,
  unpublishTripPackageAction,
  updateTripPackageAction,
} from "@/lib/actions/trip-packages";
import { uploadImageAction } from "@/lib/actions/ops";
import type {
  TripPackage,
  TripPackageDay,
  TripPackagePricingMode,
  TripPackageWriteInput,
} from "@/lib/domain/trip-package";
import type { Place } from "@/lib/domain/types";
import { CUSTOMER_LOCALES, type CustomerLocale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { TRIP_PACKAGE_STATUS_LABELS, TRIP_PACKAGE_STATUS_TONES } from "./status";

const MAX_GALLERY = 12;

const SECTIONS = [
  { id: "general", label: "ข้อมูลทั่วไป" },
  { id: "media", label: "รูปภาพและการ์ด" },
  { id: "itinerary", label: "เส้นทางการเดินทาง" },
  { id: "pricing", label: "ราคาและเงื่อนไข" },
  { id: "translations", label: "การแปลภาษา" },
  { id: "publish", label: "Preview / Publish" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/** Content language of the marketing copy — never the admin UI language. */
const CONTENT_LANG_LABELS: Record<CustomerLocale, string> = {
  th: "TH",
  en: "EN",
  zh: "ZH",
};

type TextDraft = Record<CustomerLocale, string>;
type ListDraft = Record<CustomerLocale, string>;

type StopDraft = {
  placeId: string | null;
  title: TextDraft;
  timeApprox: string;
  note: string;
};

type DayDraft = {
  dayNumber: number;
  title: TextDraft;
  description: TextDraft;
  stops: StopDraft[];
};

function emptyText(): TextDraft {
  return { th: "", en: "", zh: "" };
}

function textDraft(value: { th?: string; en?: string; zh?: string } | null | undefined): TextDraft {
  return { th: value?.th ?? "", en: value?.en ?? "", zh: value?.zh ?? "" };
}

function listDraft(
  value: { th?: string[]; en?: string[]; zh?: string[] } | null | undefined,
): ListDraft {
  return {
    th: (value?.th ?? []).join("\n"),
    en: (value?.en ?? []).join("\n"),
    zh: (value?.zh ?? []).join("\n"),
  };
}

function toLocalizedRequired(draft: TextDraft) {
  const next: { th: string; en?: string; zh?: string } = { th: draft.th.trim() };
  if (draft.en.trim()) next.en = draft.en.trim();
  if (draft.zh.trim()) next.zh = draft.zh.trim();
  return next;
}

function toLocalizedOptional(draft: TextDraft) {
  const next: { th?: string; en?: string; zh?: string } = {};
  if (draft.th.trim()) next.th = draft.th.trim();
  if (draft.en.trim()) next.en = draft.en.trim();
  if (draft.zh.trim()) next.zh = draft.zh.trim();
  return next;
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toLocalizedList(draft: ListDraft) {
  const next: { th: string[]; en?: string[]; zh?: string[] } = { th: splitLines(draft.th) };
  const en = splitLines(draft.en);
  const zh = splitLines(draft.zh);
  if (en.length) next.en = en;
  if (zh.length) next.zh = zh;
  return next;
}

function positiveInt(value: string, fallback: number, min: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

function initialDays(pkg?: TripPackage): DayDraft[] {
  if (pkg?.itinerary?.length) {
    return [...pkg.itinerary]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((day) => ({
        dayNumber: day.dayNumber,
        title: textDraft(day.title),
        description: textDraft(day.description),
        stops: day.stops.map((stop) => ({
          placeId: stop.placeId ?? null,
          title: textDraft(stop.title),
          timeApprox: stop.timeApprox ?? "",
          note: stop.note ?? "",
        })),
      }));
  }
  return [{ dayNumber: 1, title: emptyText(), description: emptyText(), stops: [] }];
}

export function TripPackageForm({
  businessId,
  pkg,
  places,
}: {
  businessId: string;
  pkg?: TripPackage;
  /** Store places for stop linking — optional, manual stops always allowed */
  places: Place[];
}) {
  const router = useRouter();
  const [section, setSection] = useState<SectionId>("general");
  const [contentLang, setContentLang] = useState<CustomerLocale>("th");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [featured, setFeatured] = useState(pkg?.featured ?? false);
  const [displayOrder, setDisplayOrder] = useState(String(pkg?.displayOrder ?? 100));
  const [days, setDays] = useState(String(pkg?.days ?? 1));
  const [nights, setNights] = useState(String(pkg?.nights ?? 0));
  const [passengerMin, setPassengerMin] = useState(String(pkg?.passengerMin ?? 1));
  const [passengerMax, setPassengerMax] = useState(String(pkg?.passengerMax ?? 4));
  const [vehicleCategoryHint, setVehicleCategoryHint] = useState(pkg?.vehicleCategoryHint ?? "");
  const [pricingMode, setPricingMode] = useState<TripPackagePricingMode>(
    pkg?.pricingMode ?? "QUOTE_FIRST",
  );
  const [priceAmount, setPriceAmount] = useState(
    pkg?.priceAmount != null ? String(pkg.priceAmount) : "",
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(pkg?.coverImageUrl ?? null);
  const [galleryImageUrls, setGalleryImageUrls] = useState<string[]>(pkg?.galleryImageUrls ?? []);
  const [title, setTitle] = useState<TextDraft>(textDraft(pkg?.title));
  const [summary, setSummary] = useState<TextDraft>(textDraft(pkg?.summary));
  const [highlights, setHighlights] = useState<ListDraft>(listDraft(pkg?.highlights));
  const [included, setIncluded] = useState<ListDraft>(listDraft(pkg?.included));
  const [notIncluded, setNotIncluded] = useState<ListDraft>(listDraft(pkg?.notIncluded));
  const [conditions, setConditions] = useState<TextDraft>(textDraft(pkg?.conditions));
  const [notes, setNotes] = useState<TextDraft>(textDraft(pkg?.notes));
  const [itinerary, setItinerary] = useState<DayDraft[]>(() => initialDays(pkg));

  const itineraryInput: TripPackageDay[] = useMemo(
    () =>
      itinerary.map((day, index) => ({
        dayNumber: index + 1,
        title: toLocalizedRequired(day.title),
        description: toLocalizedRequired(day.description),
        stops: day.stops.map((stop) => ({
          placeId: stop.placeId,
          title: toLocalizedRequired(stop.title),
          timeApprox: stop.timeApprox.trim() || null,
          note: stop.note.trim() || null,
        })),
      })),
    [itinerary],
  );

  const previewPackage: TripPackage = useMemo(() => {
    const now = pkg?.updatedAt ?? new Date().toISOString();
    const price = pricingMode === "QUOTE_FIRST" || !priceAmount.trim() ? null : Number(priceAmount);
    return {
      id: pkg?.id ?? "preview",
      businessId,
      status: pkg?.status ?? "DRAFT",
      featured,
      displayOrder: positiveInt(displayOrder, 100, 0),
      days: positiveInt(days, 1, 1),
      nights: positiveInt(nights, 0, 0),
      passengerMin: positiveInt(passengerMin, 1, 1),
      passengerMax: positiveInt(passengerMax, 1, positiveInt(passengerMin, 1, 1)),
      vehicleCategoryHint: vehicleCategoryHint.trim() || null,
      pricingMode,
      priceAmount: Number.isFinite(price) ? price : null,
      coverImageUrl: coverImageUrl ?? galleryImageUrls[0] ?? null,
      galleryImageUrls,
      title: toLocalizedRequired(title),
      summary: toLocalizedRequired(summary),
      highlights: toLocalizedList(highlights),
      included: toLocalizedList(included),
      notIncluded: toLocalizedList(notIncluded),
      conditions: toLocalizedOptional(conditions),
      notes: toLocalizedOptional(notes),
      itinerary: itineraryInput,
      createdAt: pkg?.createdAt ?? now,
      updatedAt: now,
      publishedAt: pkg?.publishedAt ?? null,
    };
  }, [
    businessId,
    conditions,
    coverImageUrl,
    days,
    displayOrder,
    featured,
    galleryImageUrls,
    highlights,
    included,
    itineraryInput,
    nights,
    notIncluded,
    notes,
    passengerMax,
    passengerMin,
    pkg,
    priceAmount,
    pricingMode,
    summary,
    title,
    vehicleCategoryHint,
  ]);

  const previewView = useMemo(
    () =>
      buildTripPackageCardView(previewPackage, {
        locale: contentLang,
        href: null,
        t: (key, params) => translate(contentLang, key, params),
      }),
    [contentLang, previewPackage],
  );

  function validate(): string | null {
    if (!title.th.trim()) return "กรุณากรอกชื่อแพ็กเกจ (ภาษาไทย)";
    if (!summary.th.trim()) return "กรุณากรอกคำอธิบายสั้น (ภาษาไทย)";
    if (!itinerary.length) return "กรุณาเพิ่มแผนการเดินทางอย่างน้อย 1 วัน";
    for (const [index, day] of itinerary.entries()) {
      if (!day.title.th.trim()) return `วันที่ ${index + 1}: กรุณากรอกหัวข้อ (ภาษาไทย)`;
      if (!day.description.th.trim()) return `วันที่ ${index + 1}: กรุณากรอกรายละเอียด (ภาษาไทย)`;
      for (const [stopIndex, stop] of day.stops.entries()) {
        if (!stop.title.th.trim()) {
          return `วันที่ ${index + 1} จุดแวะที่ ${stopIndex + 1}: กรุณากรอกชื่อจุดแวะ (ภาษาไทย)`;
        }
      }
    }
    if (pricingMode !== "QUOTE_FIRST") {
      const amount = Number(priceAmount);
      if (!priceAmount.trim() || !Number.isInteger(amount) || amount <= 0) {
        return "กรุณาระบุราคาเป็นจำนวนเต็มมากกว่า 0 บาท";
      }
    }
    return null;
  }

  function buildInput(): TripPackageWriteInput {
    const min = positiveInt(passengerMin, 1, 1);
    return {
      featured,
      displayOrder: positiveInt(displayOrder, 100, 0),
      days: positiveInt(days, 1, 1),
      nights: positiveInt(nights, 0, 0),
      passengerMin: min,
      passengerMax: positiveInt(passengerMax, min, min),
      vehicleCategoryHint: vehicleCategoryHint.trim() || null,
      pricingMode,
      priceAmount: pricingMode === "QUOTE_FIRST" ? null : Number(priceAmount),
      coverImageUrl: coverImageUrl ?? galleryImageUrls[0] ?? null,
      galleryImageUrls,
      title: toLocalizedRequired(title),
      summary: toLocalizedRequired(summary),
      highlights: toLocalizedList(highlights),
      included: toLocalizedList(included),
      notIncluded: toLocalizedList(notIncluded),
      conditions: toLocalizedOptional(conditions),
      notes: toLocalizedOptional(notes),
      itinerary: itineraryInput,
    };
  }

  /** Saves the draft; returns the package id on success. */
  async function save(): Promise<string | null> {
    const problem = validate();
    if (problem) {
      setError(problem);
      setSuccess(null);
      return null;
    }
    setError(null);
    const input = buildInput();
    if (pkg) {
      const result = await updateTripPackageAction(pkg.id, input);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      return pkg.id;
    }
    const result = await createTripPackageAction(businessId, input);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.data?.id ?? null;
  }

  async function onSave() {
    if (pending) return;
    setPending(true);
    setSuccess(null);
    const id = await save();
    setPending(false);
    if (!id) return;
    if (!pkg) {
      router.push(`/store/trip-packages/${id}`);
      router.refresh();
      return;
    }
    setSuccess("บันทึกแล้ว");
    router.refresh();
  }

  /** Save first so status changes never publish stale copy. */
  async function onStatus(
    action: (id: string) => Promise<{ ok: boolean; error?: string }>,
    okMessage: string,
  ) {
    if (pending) return;
    setPending(true);
    setSuccess(null);
    const id = await save();
    if (!id) {
      setPending(false);
      return;
    }
    const result = await action(id);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "ดำเนินการไม่สำเร็จ");
      return;
    }
    setSuccess(okMessage);
    if (!pkg) {
      router.push(`/store/trip-packages/${id}`);
    }
    router.refresh();
  }

  async function onUpload(file: File) {
    if (galleryImageUrls.length >= MAX_GALLERY) {
      setError(`อัปโหลดได้สูงสุด ${MAX_GALLERY} รูป`);
      return;
    }
    setUploading(true);
    setError(null);
    const data = new FormData();
    data.set("file", file);
    data.set("businessId", businessId);
    const result = await uploadImageAction(data);
    setUploading(false);
    if (!result.ok || !result.data) {
      setError(result.ok ? "อัปโหลดไม่สำเร็จ" : result.error);
      return;
    }
    const url = result.data.url;
    setGalleryImageUrls((current) => {
      const next = [...current, url].slice(0, MAX_GALLERY);
      return next;
    });
    if (!coverImageUrl) setCoverImageUrl(url);
  }

  function moveImage(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= galleryImageUrls.length) return;
    setGalleryImageUrls((current) => {
      const next = [...current];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  function removeImage(url: string) {
    setGalleryImageUrls((current) => {
      const next = current.filter((item) => item !== url);
      if (coverImageUrl === url) setCoverImageUrl(next[0] ?? null);
      return next;
    });
  }

  function patchDay(index: number, patch: Partial<DayDraft>) {
    setItinerary((current) =>
      current.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
  }

  function patchStop(dayIndex: number, stopIndex: number, patch: Partial<StopDraft>) {
    setItinerary((current) =>
      current.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              stops: day.stops.map((stop, s) =>
                s === stopIndex ? { ...stop, ...patch } : stop,
              ),
            }
          : day,
      ),
    );
  }

  const status = pkg?.status ?? "DRAFT";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {SECTIONS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`h-10 rounded-full px-3.5 text-sm ${
              section === item.id ? "bg-navy-800 text-white" : "bg-white text-navy-800"
            }`}
          >
            {index + 1}. {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">สถานะ:</span>
          <span className={`font-semibold ${TRIP_PACKAGE_STATUS_TONES[status]}`}>
            {TRIP_PACKAGE_STATUS_LABELS[status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">ภาษาเนื้อหา</span>
          {CUSTOMER_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setContentLang(code)}
              className={`h-8 rounded-full px-3 text-xs font-semibold ${
                contentLang === code ? "bg-accent text-navy-950" : "bg-paper text-navy-800"
              }`}
            >
              {CONTENT_LANG_LABELS[code]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">
        แท็บภาษาเปลี่ยนเฉพาะเนื้อหาที่ลูกค้าเห็น — ไม่เปลี่ยนภาษาหน้าจัดการร้าน
      </p>

      {section === "general" ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-navy-800">ข้อมูลทั่วไป</h2>
          <label className="block text-sm text-muted">
            ชื่อแพ็กเกจ ({CONTENT_LANG_LABELS[contentLang]})
            <input
              className="admin-input mt-1"
              value={title[contentLang]}
              onChange={(e) => setTitle({ ...title, [contentLang]: e.target.value })}
              placeholder={contentLang === "th" ? "เช่น เชียงใหม่ 4 วัน 3 คืน" : title.th}
            />
          </label>
          <label className="block text-sm text-muted">
            คำอธิบายสั้น ({CONTENT_LANG_LABELS[contentLang]})
            <textarea
              className="admin-input mt-1 min-h-20 py-3"
              value={summary[contentLang]}
              onChange={(e) => setSummary({ ...summary, [contentLang]: e.target.value })}
            />
          </label>
          <label className="block text-sm text-muted">
            ไฮไลต์ ({CONTENT_LANG_LABELS[contentLang]}) — บรรทัดละ 1 รายการ
            <textarea
              className="admin-input mt-1 min-h-20 py-3"
              value={highlights[contentLang]}
              onChange={(e) => setHighlights({ ...highlights, [contentLang]: e.target.value })}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-muted">
              จำนวนวัน
              <input
                className="admin-input mt-1"
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </label>
            <label className="block text-sm text-muted">
              จำนวนคืน
              <input
                className="admin-input mt-1"
                inputMode="numeric"
                value={nights}
                onChange={(e) => setNights(e.target.value)}
              />
            </label>
            <label className="block text-sm text-muted">
              ผู้โดยสารต่ำสุด
              <input
                className="admin-input mt-1"
                inputMode="numeric"
                value={passengerMin}
                onChange={(e) => setPassengerMin(e.target.value)}
              />
            </label>
            <label className="block text-sm text-muted">
              ผู้โดยสารสูงสุด
              <input
                className="admin-input mt-1"
                inputMode="numeric"
                value={passengerMax}
                onChange={(e) => setPassengerMax(e.target.value)}
              />
            </label>
            <label className="block text-sm text-muted">
              ประเภทรถที่แนะนำ (ไม่บังคับ)
              <input
                className="admin-input mt-1"
                value={vehicleCategoryHint}
                onChange={(e) => setVehicleCategoryHint(e.target.value)}
                placeholder="เช่น VAN"
              />
            </label>
            <label className="block text-sm text-muted">
              ลำดับการแสดง
              <input
                className="admin-input mt-1"
                inputMode="numeric"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            แสดงเป็นแพ็กเกจแนะนำ (ขึ้นก่อนในหน้าร้าน)
          </label>
        </section>
      ) : null}

      {section === "media" ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-navy-800">รูปภาพและการ์ด</h2>
          <div className="overflow-hidden rounded-2xl bg-paper">
            {previewPackage.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewPackage.coverImageUrl}
                alt=""
                className="h-40 w-full object-cover sm:h-44"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center text-xs text-muted sm:h-44">
                ยังไม่มีรูปปก
              </div>
            )}
            <p className="px-3 py-1.5 text-[11px] text-muted">รูปปก · แสดงในการ์ดแพ็กเกจ</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {galleryImageUrls.map((url, index) => (
              <div
                key={url}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2 ${
                  coverImageUrl === url ? "ring-accent" : "ring-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex gap-0.5 bg-black/55 p-0.5">
                  <button
                    type="button"
                    className="flex-1 text-[9px] text-white"
                    onClick={() => setCoverImageUrl(url)}
                  >
                    ปก
                  </button>
                  <button
                    type="button"
                    className="px-1 text-[9px] text-white"
                    onClick={() => moveImage(index, -1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="px-1 text-[9px] text-white"
                    onClick={() => moveImage(index, 1)}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="px-1 text-[9px] text-white"
                    onClick={() => removeImage(url)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            {galleryImageUrls.length < MAX_GALLERY ? (
              <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-paper text-[10px] text-muted">
                {uploading ? "…" : "+ เพิ่มรูป"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) await onUpload(file);
                  }}
                />
              </label>
            ) : null}
          </div>
          <p className="text-[11px] text-muted">
            สูงสุด {MAX_GALLERY} รูป · JPEG/PNG/WebP ≤ 4MB · รูปแรกเป็นรูปปกเมื่อไม่ได้เลือก
          </p>

          <div className="rounded-2xl border border-dashed border-line px-3 py-3">
            <p className="text-sm font-medium text-navy-800">สร้างรูปปกด้วย AI</p>
            <p className="mt-1 text-xs text-muted">ยังไม่ได้ตั้งค่าผู้สร้างภาพ AI</p>
            <button
              type="button"
              disabled
              title="ยังไม่ได้ตั้งค่าผู้สร้างภาพ AI"
              className="mt-2 h-10 rounded-xl bg-paper px-4 text-sm text-muted"
            >
              สร้างรูปปก (ยังไม่พร้อมใช้งาน)
            </button>
          </div>

          <CardPreview view={previewView} />
        </section>
      ) : null}

      {section === "itinerary" ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-navy-800">เส้นทางการเดินทาง</h2>
            <button
              type="button"
              onClick={() =>
                setItinerary((current) => [
                  ...current,
                  {
                    dayNumber: current.length + 1,
                    title: emptyText(),
                    description: emptyText(),
                    stops: [],
                  },
                ])
              }
              className="h-9 rounded-xl bg-paper px-3 text-sm text-navy-800"
            >
              + เพิ่มวัน
            </button>
          </div>

          {itinerary.map((day, dayIndex) => (
            <article key={dayIndex} className="space-y-2 rounded-2xl bg-paper p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy-800">วันที่ {dayIndex + 1}</p>
                {itinerary.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setItinerary((current) => current.filter((_, i) => i !== dayIndex))
                    }
                    className="text-xs text-danger"
                  >
                    ลบวันนี้
                  </button>
                ) : null}
              </div>
              <input
                className="admin-input"
                placeholder={`หัวข้อวัน (${CONTENT_LANG_LABELS[contentLang]})`}
                value={day.title[contentLang]}
                onChange={(e) =>
                  patchDay(dayIndex, {
                    title: { ...day.title, [contentLang]: e.target.value },
                  })
                }
              />
              <textarea
                className="admin-input min-h-16 py-3"
                placeholder={`รายละเอียดวัน (${CONTENT_LANG_LABELS[contentLang]})`}
                value={day.description[contentLang]}
                onChange={(e) =>
                  patchDay(dayIndex, {
                    description: { ...day.description, [contentLang]: e.target.value },
                  })
                }
              />

              {day.stops.map((stop, stopIndex) => (
                <div key={stopIndex} className="space-y-2 rounded-xl bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted">จุดแวะที่ {stopIndex + 1}</p>
                    <button
                      type="button"
                      className="text-xs text-danger"
                      onClick={() =>
                        patchDay(dayIndex, {
                          stops: day.stops.filter((_, s) => s !== stopIndex),
                        })
                      }
                    >
                      ลบ
                    </button>
                  </div>
                  {places.length ? (
                    <select
                      className="admin-input"
                      value={stop.placeId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value || null;
                        const place = places.find((item) => item.id === id);
                        patchStop(dayIndex, stopIndex, {
                          placeId: id,
                          title:
                            place && !stop.title.th.trim()
                              ? { ...stop.title, th: place.name }
                              : stop.title,
                        });
                      }}
                    >
                      <option value="">ไม่ผูกกับสถานที่ของร้าน</option>
                      {places.map((place) => (
                        <option key={place.id} value={place.id}>
                          {place.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    className="admin-input"
                    placeholder={`ชื่อจุดแวะ (${CONTENT_LANG_LABELS[contentLang]})`}
                    value={stop.title[contentLang]}
                    onChange={(e) =>
                      patchStop(dayIndex, stopIndex, {
                        title: { ...stop.title, [contentLang]: e.target.value },
                      })
                    }
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="admin-input"
                      placeholder="เวลาโดยประมาณ เช่น 09:30"
                      value={stop.timeApprox}
                      onChange={(e) =>
                        patchStop(dayIndex, stopIndex, { timeApprox: e.target.value })
                      }
                    />
                    <input
                      className="admin-input"
                      placeholder="โน้ตภายใน (ไม่บังคับ)"
                      value={stop.note}
                      onChange={(e) => patchStop(dayIndex, stopIndex, { note: e.target.value })}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  patchDay(dayIndex, {
                    stops: [
                      ...day.stops,
                      { placeId: null, title: emptyText(), timeApprox: "", note: "" },
                    ],
                  })
                }
                className="h-9 rounded-xl bg-white px-3 text-sm text-navy-800"
              >
                + เพิ่มจุดแวะ
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {section === "pricing" ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-navy-800">ราคาและเงื่อนไข</h2>
          <label className="block text-sm text-muted">
            รูปแบบราคา
            <select
              className="admin-input mt-1"
              value={pricingMode}
              onChange={(event) =>
                setPricingMode(event.target.value as TripPackagePricingMode)
              }
            >
              <option value="FIXED_PRICE">ราคาคงที่ / ทริป</option>
              <option value="STARTING_PRICE">ราคาเริ่มต้น</option>
              <option value="QUOTE_FIRST">ขอใบเสนอราคา</option>
            </select>
          </label>
          <label className="block text-sm text-muted">
            จำนวนเงิน (บาท)
            <input
              className="admin-input mt-1"
              inputMode="numeric"
              disabled={pricingMode === "QUOTE_FIRST"}
              value={priceAmount}
              onChange={(event) => setPriceAmount(event.target.value.replace(/[^\d]/g, ""))}
              placeholder={
                pricingMode === "QUOTE_FIRST" ? "ไม่ต้องระบุจำนวนเงิน" : "เช่น 12900"
              }
            />
          </label>
          <p className="text-xs text-muted">
            {pricingMode === "FIXED_PRICE"
              ? "แสดงเป็นราคาต่อทริป แต่ยังส่งคำขอผ่านขั้นตอนใบเสนอราคาเดิม"
              : pricingMode === "STARTING_PRICE"
                ? "แสดงว่าเป็นราคาเริ่มต้น ราคาสุดท้ายยืนยันในใบเสนอราคา"
                : "ไม่แสดงตัวเลข ลูกค้าจะเห็นข้อความขอใบเสนอราคา"}
          </p>

          <label className="block text-sm text-muted">
            รวมในแพ็กเกจ ({CONTENT_LANG_LABELS[contentLang]}) — บรรทัดละ 1 รายการ
            <textarea
              className="admin-input mt-1 min-h-20 py-3"
              value={included[contentLang]}
              onChange={(e) => setIncluded({ ...included, [contentLang]: e.target.value })}
            />
          </label>
          <label className="block text-sm text-muted">
            ไม่รวมในแพ็กเกจ ({CONTENT_LANG_LABELS[contentLang]}) — บรรทัดละ 1 รายการ
            <textarea
              className="admin-input mt-1 min-h-20 py-3"
              value={notIncluded[contentLang]}
              onChange={(e) => setNotIncluded({ ...notIncluded, [contentLang]: e.target.value })}
            />
          </label>
          <label className="block text-sm text-muted">
            เงื่อนไข ({CONTENT_LANG_LABELS[contentLang]})
            <textarea
              className="admin-input mt-1 min-h-20 py-3"
              value={conditions[contentLang]}
              onChange={(e) => setConditions({ ...conditions, [contentLang]: e.target.value })}
            />
          </label>
          <label className="block text-sm text-muted">
            หมายเหตุ ({CONTENT_LANG_LABELS[contentLang]})
            <textarea
              className="admin-input mt-1 min-h-20 py-3"
              value={notes[contentLang]}
              onChange={(e) => setNotes({ ...notes, [contentLang]: e.target.value })}
            />
          </label>
        </section>
      ) : null}

      {section === "translations" ? (
        <section className="space-y-4 rounded-2xl bg-white p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-navy-800">การแปลภาษา</h2>
            <p className="mt-1 text-xs text-muted">
              เนื้อหาไทยเป็นค่าเริ่มต้น — ช่องที่เว้นว่างจะแสดงภาษาไทยให้ลูกค้า ระบบไม่แปลอัตโนมัติ
            </p>
          </div>
          {(["en", "zh"] as const).map((code) => (
            <div key={code} className="space-y-2 rounded-2xl bg-paper p-3">
              <p className="text-sm font-semibold text-navy-800">
                {CONTENT_LANG_LABELS[code]} — เนื้อหาลูกค้า
              </p>
              <TranslationField
                label="ชื่อแพ็กเกจ"
                reference={title.th}
                value={title[code]}
                onChange={(value) => setTitle({ ...title, [code]: value })}
              />
              <TranslationField
                label="คำอธิบายสั้น"
                reference={summary.th}
                value={summary[code]}
                onChange={(value) => setSummary({ ...summary, [code]: value })}
                multiline
              />
              <TranslationField
                label="ไฮไลต์ (บรรทัดละ 1 รายการ)"
                reference={highlights.th}
                value={highlights[code]}
                onChange={(value) => setHighlights({ ...highlights, [code]: value })}
                multiline
              />
              <TranslationField
                label="รวมในแพ็กเกจ"
                reference={included.th}
                value={included[code]}
                onChange={(value) => setIncluded({ ...included, [code]: value })}
                multiline
              />
              <TranslationField
                label="ไม่รวมในแพ็กเกจ"
                reference={notIncluded.th}
                value={notIncluded[code]}
                onChange={(value) => setNotIncluded({ ...notIncluded, [code]: value })}
                multiline
              />
              <TranslationField
                label="เงื่อนไข"
                reference={conditions.th}
                value={conditions[code]}
                onChange={(value) => setConditions({ ...conditions, [code]: value })}
                multiline
              />
              <TranslationField
                label="หมายเหตุ"
                reference={notes.th}
                value={notes[code]}
                onChange={(value) => setNotes({ ...notes, [code]: value })}
                multiline
              />
            </div>
          ))}
          <p className="text-xs text-muted">
            หัวข้อและรายละเอียดของแต่ละวันแปลได้ในแท็บ «เส้นทางการเดินทาง» โดยสลับภาษาเนื้อหาด้านบน
          </p>
        </section>
      ) : null}

      {section === "publish" ? (
        <section className="space-y-4 rounded-2xl bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-navy-800">Preview / Publish</h2>
          <CardPreview view={previewView} />

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={pending || uploading}
              onClick={() => void onSave()}
              className="h-11 rounded-xl bg-accent text-sm font-semibold text-navy-950 disabled:opacity-60"
            >
              {pending ? "กำลังบันทึก..." : pkg ? "บันทึกการแก้ไข" : "บันทึกฉบับร่าง"}
            </button>
            <button
              type="button"
              disabled={pending || uploading}
              onClick={() =>
                void onStatus(
                  (id) => publishTripPackageAction(id),
                  "เผยแพร่แล้ว — ลูกค้าเห็นแพ็กเกจนี้ในหน้าร้าน",
                )
              }
              className="h-11 rounded-xl bg-navy-800 text-sm font-semibold text-white disabled:opacity-60"
            >
              เผยแพร่
            </button>
            {pkg ? (
              <>
                <button
                  type="button"
                  disabled={pending || status !== "PUBLISHED"}
                  onClick={() =>
                    void onStatus((id) => unpublishTripPackageAction(id), "ปิดการแสดงแล้ว")
                  }
                  className="h-11 rounded-xl bg-paper text-sm disabled:opacity-50"
                >
                  ปิดการแสดง
                </button>
                <button
                  type="button"
                  disabled={pending || status === "DRAFT"}
                  onClick={() =>
                    void onStatus((id) => setTripPackageStatusAction(id, "DRAFT"), "กลับเป็นฉบับร่าง")
                  }
                  className="h-11 rounded-xl bg-paper text-sm disabled:opacity-50"
                >
                  กลับเป็นฉบับร่าง
                </button>
                <button
                  type="button"
                  disabled={pending || status === "ARCHIVED"}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "เก็บถาวรแพ็กเกจนี้? ลูกค้าจะไม่เห็นอีก แต่ประวัติการจองที่อ้างถึงยังอยู่",
                      )
                    ) {
                      return;
                    }
                    await onStatus((id) => archiveTripPackageAction(id), "เก็บถาวรแล้ว");
                  }}
                  className="h-11 rounded-xl bg-paper text-sm text-danger disabled:opacity-50"
                >
                  เก็บถาวร
                </button>
              </>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            แพ็กเกจถูกเก็บถาวรเท่านั้น ไม่มีการลบถาวร เพื่อรักษาประวัติที่อ้างถึงแพ็กเกจนี้
          </p>
        </section>
      ) : null}

      <Feedback error={error} success={success} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || uploading}
          onClick={() => void onSave()}
          className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-navy-950 disabled:opacity-60"
        >
          {pending ? "กำลังบันทึก..." : pkg ? "บันทึกการแก้ไข" : "บันทึกฉบับร่าง"}
        </button>
        <Link href="/store/trip-packages" className="text-sm text-navy-800">
          กลับรายการแพ็กเกจ
        </Link>
      </div>
    </div>
  );
}

function TranslationField({
  label,
  reference,
  value,
  onChange,
  multiline,
}: {
  label: string;
  reference: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block text-sm text-muted">
      {label}
      {reference ? (
        <span className="mt-0.5 block whitespace-pre-line text-[11px] text-muted/80">
          TH: {reference}
        </span>
      ) : null}
      {multiline ? (
        <textarea
          className="admin-input mt-1 min-h-16 py-3"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className="admin-input mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function CardPreview({ view }: { view: TripPackageCardView }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-navy-800">ตัวอย่างการ์ดหน้าร้าน</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-paper p-3">
          <p className="mb-2 text-[11px] text-muted">เดสก์ท็อป (แถวละ 3 การ์ด)</p>
          <div className="flex gap-3 overflow-hidden">
            <TripPackageCard view={view} />
          </div>
        </div>
        <div className="rounded-2xl bg-paper p-3">
          <p className="mb-2 text-[11px] text-muted">มือถือ (เลื่อนแนวนอน)</p>
          <div className="w-[272px] max-w-full">
            <TripPackageCard view={view} width="block" />
          </div>
        </div>
      </div>
    </div>
  );
}
