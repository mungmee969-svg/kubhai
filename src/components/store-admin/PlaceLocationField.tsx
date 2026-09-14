"use client";

/**
 * Admin Place location field — search via hybrid location provider (Google when configured).
 * No-key: manual name/address/area/lat/lng; never crashes.
 */

import { useEffect, useState, useTransition } from "react";
import {
  getLocationProvider,
  isProductionMapsConfigured,
  type LocationSuggestion,
} from "@/lib/location/provider";

export type PlaceLocationValue = {
  nameHint?: string;
  address: string;
  area: string;
  latitude: string;
  longitude: string;
  googlePlaceId: string | null;
};

export function PlaceLocationField({
  value,
  onChange,
  onApplyName,
}: {
  value: PlaceLocationValue;
  onChange: (next: PlaceLocationValue) => void;
  /** Optionally sync selected place label into Place name when empty/create */
  onApplyName?: (name: string) => void;
}) {
  const mapsLive = isProductionMapsConfigured();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [pending, startTransition] = useTransition();
  const [pinMoved, setPinMoved] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = window.setTimeout(() => {
      startTransition(() => {
        void getLocationProvider()
          .search(query)
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  const visibleSuggestions = query.trim().length < 2 ? [] : suggestions;

  async function selectSuggestion(item: LocationSuggestion) {
    const provider = getLocationProvider();
    const resolved =
      (provider.resolvePlace ? await provider.resolvePlace(item.placeId) : null) ?? item;
    // Same authoritative result for name/address/lat/lng — never mix A with B
    if (
      resolved.latitude == null ||
      resolved.longitude == null ||
      !Number.isFinite(resolved.latitude) ||
      !Number.isFinite(resolved.longitude)
    ) {
      // Google prediction without details yet — keep label/address only
      onChange({
        ...value,
        address: resolved.address || value.address,
        googlePlaceId: resolved.placeId?.startsWith("cm-") ? null : resolved.placeId || null,
      });
      onApplyName?.(resolved.label);
      setQuery("");
      setSuggestions([]);
      return;
    }
    const areaGuess =
      resolved.address?.split(" ").find((part) => part.includes("นิมมาน") || part.includes("เมือง")) ||
      value.area;
    onChange({
      address: resolved.address || value.address,
      area: value.area || areaGuess || "",
      latitude: String(resolved.latitude),
      longitude: String(resolved.longitude),
      googlePlaceId: resolved.placeId?.startsWith("cm-") ? null : resolved.placeId || null,
    });
    onApplyName?.(resolved.label);
    setQuery("");
    setSuggestions([]);
    setPinMoved(false);
  }

  const lat = Number(value.latitude);
  const lng = Number(value.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-paper/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-navy-800">ตำแหน่งสถานที่</p>
        <p className="text-[11px] text-muted">
          {mapsLive ? "ค้นหาผ่าน Google Maps พร้อมแล้ว" : "ยังไม่ได้เชื่อม Google Maps"}
        </p>
      </div>

      <input
        className="admin-input"
        placeholder="ค้นหาสถานที่…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {pending ? <p className="text-[11px] text-muted">กำลังค้นหา…</p> : null}
      {visibleSuggestions.length ? (
        <ul className="max-h-40 overflow-y-auto rounded-xl bg-white ring-1 ring-black/5">
          {visibleSuggestions.map((item) => (
            <li key={item.placeId}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-paper"
                onClick={() => void selectSuggestion(item)}
              >
                <span className="font-medium text-navy-800">{item.label}</span>
                {item.address ? (
                  <span className="mt-0.5 block text-[11px] text-muted">{item.address}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        className="admin-input"
        placeholder="ที่อยู่"
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
      />
      <input
        className="admin-input"
        placeholder="ย่าน / พื้นที่"
        value={value.area}
        onChange={(e) => onChange({ ...value, area: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="admin-input"
          placeholder="ละติจูด"
          inputMode="decimal"
          value={value.latitude}
          onChange={(e) => {
            setPinMoved(true);
            onChange({ ...value, latitude: e.target.value });
          }}
        />
        <input
          className="admin-input"
          placeholder="ลองจิจูด"
          inputMode="decimal"
          value={value.longitude}
          onChange={(e) => {
            setPinMoved(true);
            onChange({ ...value, longitude: e.target.value });
          }}
        />
      </div>
      {pinMoved && value.googlePlaceId ? (
        <p className="text-[11px] text-muted">
          ปรับพิกัดแล้ว — ชื่อ/ที่อยู่เดิมยังคงไว้ (ไม่สร้างชื่อใหม่จากพิกัด)
        </p>
      ) : null}

      {hasCoords ? (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
          <iframe
            title="แผนที่สถานที่"
            className="h-40 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.015}%2C${lng + 0.02}%2C${lat + 0.015}&layer=mapnik&marker=${lat}%2C${lng}`}
          />
          <p className="px-2 py-1 text-[10px] text-muted">
            ตัวอย่างแผนที่ · พิกัด {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted">
          {mapsLive
            ? "เลือกจากผลการค้นหา หรือกรอกพิกัดเอง"
            : "ตั้งค่า GOOGLE_MAPS_API_KEY / NEXT_PUBLIC_GOOGLE_MAPS_API_KEY เพื่อค้นหาอัตโนมัติ — หรือกรอกมือได้ทันที"}
        </p>
      )}
    </div>
  );
}
