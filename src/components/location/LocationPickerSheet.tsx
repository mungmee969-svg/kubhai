"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getLocationProvider,
  isProductionMapsConfigured,
  type LocationSuggestion,
} from "@/lib/location/provider";
import { customerLocationAddress, customerLocationTitle } from "@/lib/location/display";
import type { LocationSource, StructuredLocation } from "@/lib/domain/location";

const NOTE_HINTS = ["รอหน้า Lobby", "ประตู 3 ชั้น 1", "หน้าโรงแรม", "โทรก่อนถึง"];

type Props = {
  open: boolean;
  title: string;
  value: StructuredLocation | null;
  onClose: () => void;
  onSelect: (next: StructuredLocation) => void;
};

export function LocationPickerSheet({ open, title, value, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [popular, setPopular] = useState<LocationSuggestion[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState(false);
  const [pinLat, setPinLat] = useState("18.7883");
  const [pinLng, setPinLng] = useState("98.9853");
  const [note, setNote] = useState(value?.customerNote ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getLocationProvider()
      .popular()
      .then((items) => {
        if (!cancelled) setPopular(items);
      })
      .catch(() => {
        if (!cancelled) setPopular([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || mapMode) return;
    const handle = window.setTimeout(() => {
      startTransition(() => {
        void getLocationProvider()
          .search(query)
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      });
    }, 160);
    return () => window.clearTimeout(handle);
  }, [query, open, mapMode]);

  if (!open) return null;

  function finish(loc: StructuredLocation) {
    onSelect({ ...loc, customerNote: note.trim() || null });
    onClose();
  }

  async function selectSuggestion(item: LocationSuggestion, source: LocationSource = "SEARCH") {
    let resolved = item;
    const needsDetails =
      !Number.isFinite(item.latitude) ||
      !Number.isFinite(item.longitude) ||
      (item.latitude === 0 && item.longitude === 0 && !item.placeId.startsWith("cm-"));
    if (needsDetails) {
      const detailed = await getLocationProvider().resolvePlace?.(item.placeId);
      if (detailed) resolved = detailed;
      else if (needsDetails && item.latitude === 0 && item.longitude === 0) {
        // Incomplete Google result without details — keep label/address, null coords
        finish({
          label: item.label,
          address: item.address || null,
          latitude: null,
          longitude: null,
          placeId: item.placeId,
          placeType: item.placeType,
          customerNote: note.trim() || null,
          source,
        });
        return;
      }
    }
    finish({
      label: resolved.label,
      address: resolved.address || null,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      placeId: resolved.placeId,
      placeType: resolved.placeType,
      customerNote: note.trim() || null,
      source,
    });
  }

  function applyManual() {
    const label = query.trim();
    if (label.length < 2) return;
    finish({
      label,
      address: null,
      latitude: null,
      longitude: null,
      placeId: null,
      placeType: null,
      customerNote: note.trim() || null,
      source: "MANUAL",
    });
  }

  function useCurrentLocation() {
    setGeoError(null);
    setGeoHint(null);
    if (!navigator.geolocation) {
      setGeoError("อุปกรณ์ไม่รองรับตำแหน่งปัจจุบัน");
      setGeoHint("ค้นหาสถานที่หรือปักหมุดแทน");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void getLocationProvider()
          .reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          .then((loc) => {
            if (pos.coords.accuracy > 100) {
              setGeoHint("ตำแหน่งอาจคลาดเคลื่อน — ตรวจสอบชื่อสถานที่ก่อนยืนยัน");
            }
            finish({ ...loc, customerNote: note.trim() || null, source: "CURRENT_LOCATION" });
          });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoError("ไม่ได้รับอนุญาตใช้ตำแหน่ง");
        else if (err.code === err.TIMEOUT) setGeoError("ขอตำแหน่งหมดเวลา");
        else setGeoError("ไม่สามารถอ่านตำแหน่งได้");
        setGeoHint("ค้นหาสถานที่หรือปักหมุดแทน");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  function applyPin() {
    const latitude = Number(pinLat);
    const longitude = Number(pinLng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setGeoError("พิกัดไม่ถูกต้อง");
      return;
    }
    void getLocationProvider()
      .reverseGeocode(latitude, longitude)
      .then((loc) => finish({ ...loc, customerNote: note.trim() || null, source: "MAP_PIN" }));
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-[color:var(--store-ink,#0F1724)]/45" onClick={onClose} aria-label="ปิด" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col rounded-t-[1.75rem] bg-[color:var(--store-paper,#F7F4EF)] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:max-w-md md:rounded-none">
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted">เลือกสถานที่</p>
            <h2 className="text-lg font-semibold text-[color:var(--store-ink,#0F1724)]">
              {title.startsWith("เลือก") ? title : `เลือก${title}`}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-sm text-muted">
            ปิด
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)] shadow-sm"
            >
              ตำแหน่งปัจจุบัน
            </button>
            <button
              type="button"
              onClick={() => setMapMode((v) => !v)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)] shadow-sm"
            >
              ปักหมุด
            </button>
          </div>

          {geoError ? <p className="text-xs text-danger">{geoError}</p> : null}
          {geoHint ? <p className="text-xs text-muted">{geoHint}</p> : null}

          {mapMode ? (
            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs leading-5 text-muted">
                ปักหมุดบนแผนที่ — ระบบจะบันทึกพิกัดไว้สำหรับการดำเนินงาน และแสดงชื่อสถานที่ให้คุณอ่าน
                {isProductionMapsConfigured()
                  ? ""
                  : " (โหมดท้องถิ่น — ตั้งค่า Google Maps API เพื่อค้นหาทั่วประเทศ)"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-muted">ละติจูด</span>
                  <input
                    className="wizard-input"
                    value={pinLat}
                    onChange={(e) => setPinLat(e.target.value)}
                    inputMode="decimal"
                    aria-label="ละติจูด"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted">ลองจิจูด</span>
                  <input
                    className="wizard-input"
                    value={pinLng}
                    onChange={(e) => setPinLng(e.target.value)}
                    inputMode="decimal"
                    aria-label="ลองจิจูด"
                  />
                </label>
              </div>
              <button type="button" onClick={applyPin} className="booking-cta-primary">
                ใช้ตำแหน่งนี้
              </button>
            </div>
          ) : (
            <>
              <input
                className="wizard-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาสถานที่"
                autoFocus
                aria-label="ค้นหาสถานที่"
              />
              {!query.trim() && popular.length ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">สถานที่ยอดนิยม</p>
                  <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">
                    {popular.map((item) => (
                      <li key={item.placeId} className="border-b border-[color:var(--store-line,#E8E2D8)] last:border-0">
                        <button
                          type="button"
                          onClick={() => selectSuggestion(item, "SAVED_PLACE")}
                          className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                        >
                          <span className="mt-0.5 text-sm" aria-hidden>
                            📍
                          </span>
                          <span>
                            <span className="block text-sm font-medium">{item.label}</span>
                            <span className="block text-xs text-muted">{item.address}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {suggestions.map((item) => (
                  <li key={item.placeId} className="border-b border-[color:var(--store-line,#E8E2D8)] last:border-0">
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                      onClick={() => selectSuggestion(item)}
                    >
                      <span className="mt-0.5 text-sm" aria-hidden>
                        📍
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="block text-xs text-muted">{item.address}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {query.trim().length >= 2 ? (
                  <li>
                    <button
                      type="button"
                      disabled={pending}
                      className="w-full px-4 py-3.5 text-left text-sm font-medium text-[color:var(--store-primary,#0F3D3E)]"
                      onClick={applyManual}
                    >
                      ใช้ “{query.trim()}”
                    </button>
                  </li>
                ) : null}
              </ul>
            </>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">หมายเหตุจุดรับ/ส่ง</p>
            <input
              className="wizard-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น รอหน้า Lobby"
            />
            <div className="flex flex-wrap gap-2">
              {NOTE_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  className="min-h-10 rounded-full bg-white px-3 py-1.5 text-[11px] shadow-sm"
                  onClick={() => setNote(hint)}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompactLocationField({
  label,
  required,
  value,
  placeholder,
  onOpen,
  onClearNote,
}: {
  label: string;
  required?: boolean;
  value: StructuredLocation | null;
  placeholder: string;
  onOpen: () => void;
  onClearNote?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium tracking-wide text-muted">
        {label}
        {required ? " *" : ""}
      </p>
      {value ? (
        <div className="booking-loc-card">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--store-primary-soft,#E7EFEA)] text-sm text-[color:var(--store-primary,#0F3D3E)]"
            aria-hidden
          >
            📍
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--store-ink,#0F1724)]">
              {customerLocationTitle(value)}
            </p>
            {customerLocationAddress(value) ? (
              <p className="mt-0.5 text-xs leading-5 text-muted">{customerLocationAddress(value)}</p>
            ) : null}
            {value.customerNote ? (
              <p className="mt-1 text-xs text-[color:var(--store-primary,#0F3D3E)]">หมายเหตุ: {value.customerNote}</p>
            ) : null}
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={onOpen}
                className="min-h-11 text-xs font-semibold text-[color:var(--store-primary,#0F3D3E)]"
              >
                แก้ไข
              </button>
              {value.customerNote && onClearNote ? (
                <button type="button" onClick={onClearNote} className="min-h-11 text-xs text-muted">
                  ลบหมายเหตุ
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onOpen} className="booking-loc-card min-h-14">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--store-primary-soft,#E7EFEA)] text-sm"
            aria-hidden
          >
            📍
          </span>
          <span className="text-sm text-muted">{placeholder}</span>
        </button>
      )}
    </div>
  );
}
