"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getLocationProvider,
  isProductionMapsConfigured,
  type LocationSuggestion,
} from "@/lib/location/provider";
import type { LocationSource, StructuredLocation } from "@/lib/domain/location";

type Props = {
  label: string;
  required?: boolean;
  value: StructuredLocation | null;
  onChange: (next: StructuredLocation | null) => void;
  placeholder?: string;
};

const NOTE_HINTS = ["รอหน้า Lobby", "ประตู 3 ชั้น 1", "หน้าโรงแรม", "โทรก่อนถึง"];

export function LocationPicker({
  label,
  required,
  value,
  onChange,
  placeholder = "ค้นหาสถานที่",
}: Props) {
  const [mode, setMode] = useState<"idle" | "search" | "map" | "edit">(value ? "idle" : "search");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [popular, setPopular] = useState<LocationSuggestion[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [pinLat, setPinLat] = useState("18.7883");
  const [pinLng, setPinLng] = useState("98.9853");
  const [pending, startTransition] = useTransition();
  const mapsLive = isProductionMapsConfigured();

  useEffect(() => {
    void getLocationProvider()
      .popular()
      .then(setPopular)
      .catch(() => setPopular([]));
  }, []);

  useEffect(() => {
    if (mode !== "search") return;
    const handle = window.setTimeout(() => {
      startTransition(() => {
        void getLocationProvider()
          .search(query)
          .then(setSuggestions)
          .catch(() => setSuggestions([]));
      });
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, mode]);

  function selectSuggestion(item: LocationSuggestion, source: LocationSource = "SEARCH") {
    onChange({
      label: item.label,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
      placeId: item.placeId,
      placeType: item.placeType,
      customerNote: value?.customerNote ?? null,
      source,
    });
    setMode("idle");
    setGeoError(null);
  }

  function applyManualLabel() {
    const labelText = query.trim();
    if (labelText.length < 2) return;
    onChange({
      label: labelText,
      address: null,
      latitude: null,
      longitude: null,
      placeId: null,
      placeType: null,
      customerNote: value?.customerNote ?? null,
      source: "MANUAL",
    });
    setMode("idle");
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
        const { latitude, longitude, accuracy } = pos.coords;
        void getLocationProvider()
          .reverseGeocode(latitude, longitude)
          .then((loc) => {
            onChange({
              ...loc,
              customerNote: value?.customerNote ?? null,
              source: "CURRENT_LOCATION",
            });
            setMode("idle");
            if (accuracy > 100) {
              setGeoHint("ตำแหน่งอาจคลาดเคลื่อน — ตรวจสอบชื่อสถานที่ก่อนยืนยัน");
            }
          });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("ไม่ได้รับอนุญาตใช้ตำแหน่ง");
        } else if (err.code === err.TIMEOUT) {
          setGeoError("ขอตำแหน่งหมดเวลา");
        } else {
          setGeoError("ไม่สามารถอ่านตำแหน่งได้");
        }
        setGeoHint("ค้นหาสถานที่หรือปักหมุดแทน");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  function applyMapPin() {
    const latitude = Number(pinLat);
    const longitude = Number(pinLng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setGeoError("พิกัดหมุดไม่ถูกต้อง");
      return;
    }
    void getLocationProvider()
      .reverseGeocode(latitude, longitude)
      .then((loc) => {
        onChange({
          ...loc,
          source: "MAP_PIN",
          customerNote: value?.customerNote ?? null,
        });
        setMode("idle");
        setGeoError(null);
      });
  }

  if (value && mode === "idle") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="rounded-2xl border border-[color:var(--store-line,#E5E7EB)] bg-white p-3">
          <p className="text-sm font-semibold">{value.label}</p>
          {value.address ? <p className="mt-1 text-xs text-muted">{value.address}</p> : null}
          {value.latitude != null && value.longitude != null ? (
            <p className="mt-2 text-[11px] text-muted">
              แผนที่ (ตัวอย่าง) · {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-muted">ข้อความอย่างเดียว — ไม่มีพิกัด</p>
          )}
          {value.customerNote ? (
            <p className="mt-2 text-xs">
              <span className="text-muted">หมายเหตุ:</span> {value.customerNote}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="h-9 rounded-xl bg-[color:var(--store-primary,#0F766E)] px-3 text-xs text-white"
              onClick={() => setMode("edit")}
            >
              แก้ไข
            </button>
            {value.latitude != null && value.longitude != null ? (
              <a
                className="inline-flex h-9 items-center rounded-xl border border-[color:var(--store-line,#E5E7EB)] px-3 text-xs"
                href={`https://www.google.com/maps?q=${value.latitude},${value.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                ดูบนแผนที่
              </a>
            ) : null}
          </div>
        </div>
        <NoteEditor
          note={value.customerNote}
          onChange={(customerNote) => onChange({ ...value, customerNote })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </p>
      {!mapsLive ? (
        <p className="text-[11px] text-muted">
          ค้นหาจากแคตตาล็อกท้องถิ่น (ยังไม่ต่อ Google/Mapbox จริง)
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-9 rounded-xl bg-[color:var(--store-primary,#0F766E)] px-3 text-xs text-white"
          onClick={() => setMode("search")}
        >
          ค้นหา
        </button>
        <button
          type="button"
          className="h-9 rounded-xl border border-[color:var(--store-line,#E5E7EB)] bg-white px-3 text-xs"
          onClick={useCurrentLocation}
        >
          ใช้ตำแหน่งปัจจุบัน
        </button>
        <button
          type="button"
          className="h-9 rounded-xl border border-[color:var(--store-line,#E5E7EB)] bg-white px-3 text-xs"
          onClick={() => setMode("map")}
        >
          ปักหมุด
        </button>
      </div>

      {geoError ? <p className="text-xs text-danger">{geoError}</p> : null}
      {geoHint ? <p className="text-xs text-muted">{geoHint}</p> : null}

      {mode === "map" ? (
        <div className="space-y-2 rounded-2xl bg-white p-3">
          <p className="text-xs text-muted">แผนที่แบบเต็มจะเปิดเมื่อมี API — ตอนนี้ปักหมุดด้วยพิกัด</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              value={pinLat}
              onChange={(e) => setPinLat(e.target.value)}
              placeholder="ละติจูด"
              inputMode="decimal"
            />
            <input
              className="input"
              value={pinLng}
              onChange={(e) => setPinLng(e.target.value)}
              placeholder="ลองจิจูด"
              inputMode="decimal"
            />
          </div>
          <button type="button" className="h-10 w-full rounded-xl bg-navy-800 text-sm text-white" onClick={applyMapPin}>
            ใช้หมุดนี้
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            className="input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMode("search");
            }}
            placeholder={placeholder}
            required={required && !value}
          />
          {popular.length && !query.trim() ? (
            <div className="flex flex-wrap gap-2">
              {popular.map((item) => (
                <button
                  key={item.placeId}
                  type="button"
                  className="rounded-full bg-white px-3 py-1 text-xs"
                  onClick={() => selectSuggestion(item, "SAVED_PLACE")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="overflow-hidden rounded-2xl bg-white">
            {suggestions.map((item) => (
              <li key={item.placeId}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-paper"
                  onClick={() => selectSuggestion(item)}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted">{item.address}</span>
                </button>
              </li>
            ))}
            {query.trim().length >= 2 ? (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-[color:var(--store-primary,#0F766E)]"
                  onClick={applyManualLabel}
                  disabled={pending}
                >
                  ใช้ข้อความ “{query.trim()}”
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      {value ? (
        <NoteEditor
          note={value.customerNote}
          onChange={(customerNote) => onChange({ ...value, customerNote })}
        />
      ) : null}
    </div>
  );
}

function NoteEditor({
  note,
  onChange,
}: {
  note: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        className="input"
        value={note ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="หมายเหตุจุดรับ/ส่ง เช่น รอหน้า Lobby"
      />
      <div className="flex flex-wrap gap-2">
        {NOTE_HINTS.map((hint) => (
          <button
            key={hint}
            type="button"
            className="rounded-full border border-[color:var(--store-line,#E5E7EB)] bg-white px-2.5 py-1 text-[11px]"
            onClick={() => onChange(hint)}
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
}
