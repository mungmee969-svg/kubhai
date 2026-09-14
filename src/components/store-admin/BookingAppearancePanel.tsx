"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBusinessProfileAction, uploadImageAction } from "@/lib/actions/ops";
import {
  hasBookingCapability,
  normalizeSubscriptionPlan,
  PLAN_UNLOCK_HINT,
  planUnlockHref,
} from "@/lib/domain/booking-entitlements";
import { resolveBookingPresentation } from "@/lib/domain/booking-presentation";
import type { Business, Province, Region } from "@/lib/domain/types";
import { Feedback } from "./ui/Feedback";

export function BookingAppearancePanel({
  businessId,
  business,
  province = null,
  region = null,
}: {
  businessId: string;
  business: Business;
  province?: Province | null;
  region?: Region | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(business.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(business.primaryColor ?? "#0F3D3E");
  const [accentColor, setAccentColor] = useState(business.accentColor ?? "#C4A35A");
  const [bookingTagline, setBookingTagline] = useState(business.bookingTagline ?? "");
  const [bookingHeroImageUrl, setBookingHeroImageUrl] = useState(business.bookingHeroImageUrl ?? "");
  const [bookingMobileHeroImageUrl, setBookingMobileHeroImageUrl] = useState(
    business.bookingMobileHeroImageUrl ?? "",
  );
  const [bookingLayoutPreset, setBookingLayoutPreset] = useState(
    business.bookingLayoutPreset ?? "standard-6-card",
  );

  const planId = normalizeSubscriptionPlan(business.subscriptionPlan);
  const canHero = hasBookingCapability(business.subscriptionPlan, "booking.customHero");
  const canTheme = hasBookingCapability(business.subscriptionPlan, "booking.customTheme");
  const canLayout = hasBookingCapability(business.subscriptionPlan, "booking.customLayout");

  const previewBusiness = useMemo(
    () => ({
      ...business,
      logoUrl: logoUrl || null,
      primaryColor,
      accentColor,
      bookingTagline: bookingTagline || null,
      bookingHeroImageUrl: bookingHeroImageUrl || null,
      bookingMobileHeroImageUrl: bookingMobileHeroImageUrl || null,
      bookingLayoutPreset: bookingLayoutPreset || null,
    }),
    [
      business,
      logoUrl,
      primaryColor,
      accentColor,
      bookingTagline,
      bookingHeroImageUrl,
      bookingMobileHeroImageUrl,
      bookingLayoutPreset,
    ],
  );

  const preview = resolveBookingPresentation({
    business: previewBusiness,
    province,
    region,
  });

  async function upload(kind: "logo" | "booking-hero" | "booking-hero-mobile", file: File) {
    setPending(true);
    setError(null);
    const data = new FormData();
    data.set("file", file);
    data.set("businessId", businessId);
    const result = await uploadImageAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const url = result.data?.url ?? "";
    if (kind === "logo") setLogoUrl(url);
    if (kind === "booking-hero") setBookingHeroImageUrl(url);
    if (kind === "booking-hero-mobile") setBookingMobileHeroImageUrl(url);
  }

  async function save() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const payload: Record<string, unknown> = {
      name: business.name,
      logoUrl: logoUrl || null,
      primaryColor,
      accentColor,
      description: business.description,
      phone: business.phone,
      lineUrl: business.lineUrl,
      facebookUrl: business.facebookUrl,
      instagramUrl: business.instagramUrl,
      websiteUrl: business.websiteUrl,
      email: business.email,
      address: business.address,
    };
    if (canTheme) payload.bookingTagline = bookingTagline || null;
    if (canHero) {
      payload.bookingHeroImageUrl = bookingHeroImageUrl || null;
      payload.bookingMobileHeroImageUrl = bookingMobileHeroImageUrl || null;
    }
    if (canLayout) payload.bookingLayoutPreset = bookingLayoutPreset || null;

    const result = await saveBusinessProfileAction(businessId, payload);
    setPending(false);
    if (!result.ok) setError(result.error);
    else {
      setSuccess("บันทึกรูปลักษณ์หน้าการจองแล้ว");
      router.refresh();
    }
  }

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5">
      <div>
        <h2 className="font-semibold text-navy-800">รูปลักษณ์หน้าการจอง</h2>
        <p className="mt-1 text-sm text-muted">
          ธีมท่องเที่ยวตามจังหวัด · แบรนด์ร้านทับด้านบน · แพ็กเกจปัจจุบัน: {planId}
        </p>
      </div>
      <Feedback error={error} success={success} />

      <div className="overflow-hidden rounded-2xl border border-line">
        <div
          className="relative h-36 overflow-hidden text-white"
          style={{ background: primaryColor }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.hero.desktopUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            style={{ objectPosition: preview.hero.objectPositionDesktop }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 to-black/55" />
          <div className="relative flex h-full flex-col justify-between p-4">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-9 w-9 rounded-[22%] bg-white object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-[22%] bg-white/20 text-sm font-bold">
                  {(business.shortName || business.name).slice(0, 1)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">{business.name}</p>
                <p className="text-[11px] text-white/75">{preview.placeLabel}</p>
              </div>
            </div>
            <p className="max-w-[16rem] text-sm font-medium leading-snug">
              {preview.displayTagline || `เดินทาง${preview.placeLabel}อย่างสบายใจ`}
            </p>
          </div>
        </div>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">
          ตัวอย่างสด · แหล่งภาพ: {preview.hero.source}
          {preview.customHeroRetainedButInactive
            ? " · มีภาพร้านเก็บไว้แต่ยังไม่แสดง (แพ็กเกจปัจจุบัน)"
            : ""}
        </p>
      </div>

      <label className="block text-sm text-muted">
        โลโก้ร้าน
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload("logo", file);
          }}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">
          สีแบรนด์
          <input
            type="color"
            className="mt-1 block h-10 w-full"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
          />
        </label>
        <label className="text-sm text-muted">
          สีเน้น
          <input
            type="color"
            className="mt-1 block h-10 w-full"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
          />
        </label>
      </div>

      <LockedField
        unlocked={canTheme}
        label="ข้อความต้อนรับ"
        hint={PLAN_UNLOCK_HINT["booking.customTheme"]}
      >
        <textarea
          className="admin-input min-h-20 py-3"
          placeholder="เช่น เดินทางเชียงใหม่อย่างสบายใจ"
          value={bookingTagline}
          disabled={!canTheme}
          onChange={(e) => setBookingTagline(e.target.value)}
        />
      </LockedField>

      <LockedField
        unlocked={canHero}
        label="ภาพ Hero ของร้าน (เดสก์ท็อป)"
        hint={PLAN_UNLOCK_HINT["booking.customHero"]}
      >
        <input
          className="admin-input"
          placeholder="/uploads/..."
          value={bookingHeroImageUrl}
          disabled={!canHero}
          onChange={(e) => setBookingHeroImageUrl(e.target.value)}
        />
        {canHero ? (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 block text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload("booking-hero", file);
            }}
          />
        ) : null}
      </LockedField>

      <LockedField
        unlocked={canHero}
        label="ภาพ Hero มือถือ"
        hint={PLAN_UNLOCK_HINT["booking.customHero"]}
      >
        <input
          className="admin-input"
          placeholder="ว่าง = ใช้ภาพเดสก์ท็อป + จัดตำแหน่งอัตโนมัติ"
          value={bookingMobileHeroImageUrl}
          disabled={!canHero}
          onChange={(e) => setBookingMobileHeroImageUrl(e.target.value)}
        />
        {canHero ? (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 block text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload("booking-hero-mobile", file);
            }}
          />
        ) : null}
      </LockedField>

      <LockedField
        unlocked={canLayout}
        label="รูปแบบเลย์เอาต์"
        hint={PLAN_UNLOCK_HINT["booking.customLayout"]}
      >
        <select
          className="admin-input"
          value={bookingLayoutPreset}
          disabled={!canLayout}
          onChange={(e) => setBookingLayoutPreset(e.target.value)}
        >
          <option value="standard-6-card">มาตรฐาน 6 การ์ด</option>
          <option value="compact-6-card">กะทัดรัด 6 การ์ด</option>
        </select>
      </LockedField>

      <p className="text-xs text-muted">
        ธีมพื้นหลังตามจังหวัด: {preview.locationTheme.labelTh} ({preview.locationTheme.themeId})
        — ไม่ใช่ภาพรถ และไม่ผูกแบรนด์ร้านอื่น
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950 disabled:opacity-60"
      >
        บันทึกรูปลักษณ์
      </button>
    </section>
  );
}

function LockedField({
  unlocked,
  label,
  hint,
  children,
}: {
  unlocked: boolean;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className={unlocked ? "space-y-2" : "space-y-2 opacity-80"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-navy-800">{label}</p>
        {!unlocked ? (
          <p className="text-xs text-muted">
            {hint} —{" "}
            <Link href={planUnlockHref()} className="font-semibold text-navy-800 underline underline-offset-2">
              ดูแพ็กเกจ
            </Link>
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
