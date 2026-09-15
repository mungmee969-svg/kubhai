/**
 * Authoritative booking submit mapping + validation.
 * Review UI and server submit must use the same helpers.
 */

import type { BookingSource } from "@/lib/domain/enums";
import type { StructuredLocation } from "@/lib/domain/location";
import { bookingRequestSchema } from "@/lib/validation/booking";
import {
  buildDaysFromDuration,
  collectPlaceIdsFromDays,
  daysToItineraryItems,
  derivedEndDate,
  finalDropoffFromDays,
  initialPickupFromDays,
  type DayPlan,
} from "@/lib/booking/itinerary";
import {
  bookingRequestId,
  bookingSessionId,
  emptyBookingDraft,
  isMultiDayService,
  type BookingDraft,
  type BookingSubmitPayload,
  type BookingWizardStep,
} from "@/lib/booking/draft";
import {
  filterUuidPlaceIds,
  isUuid,
  normalizeClockTime,
} from "@/lib/booking/normalize";

export { filterUuidPlaceIds, isUuid, normalizeClockTime } from "@/lib/booking/normalize";

export type BookingFieldIssue = {
  path: string;
  code: string;
  /** Customer-facing Thai message — never expose raw paths in UI copy alone */
  message: string;
  step: BookingWizardStep;
  section: "trip" | "vehicle" | "customer" | "other";
};

export type BookingSubmitBuildResult =
  | { ok: true; payload: BookingSubmitPayload }
  | { ok: false; issues: BookingFieldIssue[]; error: string };

function locFields(loc: StructuredLocation | null) {
  if (!loc) {
    return {
      label: null as string | null,
      latitude: null as number | null,
      longitude: null as number | null,
      address: null as string | null,
      placeId: null as string | null,
      customerNote: null as string | null,
      source: null as StructuredLocation["source"] | null,
    };
  }
  return {
    label: loc.label?.trim() || null,
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
    address: loc.address?.trim() || null,
    placeId: loc.placeId?.trim() || null,
    customerNote: loc.customerNote?.trim() || null,
    source: loc.source ?? null,
  };
}

function issue(
  path: string,
  code: string,
  message: string,
  step: BookingWizardStep,
  section: BookingFieldIssue["section"],
): BookingFieldIssue {
  return { path, code, message, step, section };
}

/** Draft-level issues shown on Review before / instead of opaque server errors. */
export function collectBookingDraftIssues(draft: BookingDraft): BookingFieldIssue[] {
  const issues: BookingFieldIssue[] = [];
  const multi = isMultiDayService(draft.serviceType);

  if (!draft.serviceType) {
    issues.push(issue("serviceType", "required", "กรุณาเลือกรูปแบบการเดินทาง", 1, "trip"));
  }
  if (!draft.startDate) {
    issues.push(issue("startDate", "required", "กรุณาเลือกวันที่เดินทาง", 2, "trip"));
  }

  if (multi) {
    if (!draft.numberOfDays || draft.numberOfDays < 1) {
      issues.push(issue("numberOfDays", "required", "กรุณาเลือกจำนวนวัน", 2, "trip"));
    }
    const days =
      draft.startDate && draft.numberOfDays
        ? draft.days.length === draft.numberOfDays
          ? draft.days
          : buildDaysFromDuration(draft.startDate, draft.numberOfDays, draft.days)
        : draft.days;
    const pickup = initialPickupFromDays(days);
    const dropoff = finalDropoffFromDays(days);
    if (!pickup?.label?.trim()) {
      issues.push(
        issue("pickupLocation", "required", "กรุณาเลือกจุดรับเริ่มต้นของวันที่ 1", 2, "trip"),
      );
    }
    if (!dropoff?.label?.trim()) {
      issues.push(
        issue(
          "dropoffLocation",
          "required",
          "กรุณาเลือกช่วงวันสุดท้ายของทริป / จุดส่งสุดท้าย",
          2,
          "trip",
        ),
      );
    }
    const startTime = normalizeClockTime(days[0]?.startTime || draft.startTime);
    if (!startTime) {
      issues.push(issue("startTime", "required", "กรุณาเลือกเวลาเดินทาง", 2, "trip"));
    }
  } else {
    const startTime = normalizeClockTime(draft.startTime);
    if (!startTime) {
      issues.push(issue("startTime", "required", "กรุณาเลือกเวลาเดินทาง", 2, "trip"));
    }
    if (!draft.pickup?.label?.trim() || draft.pickup.label.trim().length < 2) {
      issues.push(issue("pickupLocation", "required", "กรุณาระบุจุดรับ", 2, "trip"));
    }
    if (!draft.dropoff?.label?.trim() || draft.dropoff.label.trim().length < 2) {
      issues.push(issue("dropoffLocation", "required", "กรุณาระบุจุดหมายปลายทาง", 2, "trip"));
    }
    if (draft.multiDay && draft.endTime) {
      const endTime = normalizeClockTime(draft.endTime);
      if (!endTime) {
        issues.push(issue("endTime", "invalid", "กรุณาเลือกเวลาสิ้นสุดที่ถูกต้อง", 2, "trip"));
      }
    }
  }

  if (!draft.letStoreChooseVehicle && !draft.preferredVehicleId) {
    issues.push(
      issue("preferredVehicleId", "required", "กรุณาเลือกรถ หรือให้ทางร้านแนะนำรถ", 3, "vehicle"),
    );
  }
  if (
    !draft.letStoreChooseVehicle &&
    draft.preferredVehicleId &&
    !isUuid(draft.preferredVehicleId)
  ) {
    issues.push(issue("preferredVehicleId", "invalid", "กรุณาเลือกรถอีกครั้ง", 3, "vehicle"));
  }

  if (!draft.name.trim() || draft.name.trim().length < 2) {
    issues.push(issue("customerName", "required", "กรุณากรอกชื่อ", 4, "customer"));
  }
  if (!draft.phone.trim() || draft.phone.trim().length < 8) {
    issues.push(issue("customerPhone", "required", "กรุณากรอกเบอร์โทร", 4, "customer"));
  }
  if (draft.email.trim()) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());
    if (!emailOk) {
      issues.push(issue("customerEmail", "invalid", "รูปแบบอีเมลไม่ถูกต้อง", 4, "customer"));
    }
  }

  if (draft.passengers < 1 || draft.passengers > 20) {
    issues.push(issue("passengerCount", "invalid", "จำนวนผู้โดยสารไม่ถูกต้อง", 3, "trip"));
  }

  return issues;
}

export function summarizeIssues(issues: BookingFieldIssue[]): string {
  if (!issues.length) return "";
  if (issues.length === 1) return issues[0].message;
  return `ยังมีข้อมูลที่ต้องแก้ ${issues.length} จุด`;
}

export function firstIssueStep(issues: BookingFieldIssue[]): BookingWizardStep {
  return issues[0]?.step ?? 1;
}

function resolveDays(draft: BookingDraft): DayPlan[] {
  if (!isMultiDayService(draft.serviceType)) return draft.days;
  if (!draft.startDate || !draft.numberOfDays) return draft.days;
  if (draft.days.length === draft.numberOfDays) return draft.days;
  return buildDaysFromDuration(draft.startDate, draft.numberOfDays, draft.days);
}

/**
 * Canonical mapper used by Review diagnostics and submit.
 * Does not invent coordinates; label is enough for local catalog/manual.
 */
export function buildBookingSubmitPayload(
  slug: string,
  draft: BookingDraft,
  source: BookingSource,
  options?: { sessionId?: string; clientRequestId?: string; referrer?: string | null },
): BookingSubmitBuildResult {
  const normalized = normalizeDraftForSubmit(draft);
  const issues = collectBookingDraftIssues(normalized);
  if (issues.length) {
    return { ok: false, issues, error: summarizeIssues(issues) };
  }

  const multi = isMultiDayService(normalized.serviceType);
  let pickup = normalized.pickup;
  let dropoff = normalized.dropoff;
  let endDate: string | null =
    normalized.multiDay && normalized.endDate ? normalized.endDate : null;
  let endTime: string | null =
    normalized.multiDay && normalized.endTime
      ? normalizeClockTime(normalized.endTime)
      : null;
  let itineraryDays: ReturnType<typeof daysToItineraryItems> = [];
  let placeIds = filterUuidPlaceIds(normalized.placeIds);

  if (multi) {
    const days = resolveDays(normalized);
    pickup = initialPickupFromDays(days);
    dropoff = finalDropoffFromDays(days);
    endDate = derivedEndDate(normalized.startDate, normalized.numberOfDays);
    endTime = normalizeClockTime(days[days.length - 1]?.endTime || normalized.endTime);
    itineraryDays = daysToItineraryItems(days);
    placeIds = filterUuidPlaceIds(collectPlaceIdsFromDays(days));
    if (normalized.storeHelpInterests.length || normalized.letStorePlanTrip) {
      itineraryDays.push({
        dayNumber: 0,
        sortOrder: 999,
        kind: "STORE_HELP",
        title: "ให้ร้านช่วยจัดทริป",
        location: null,
        placeId: null,
        note:
          [
            normalized.storeHelpInterests.length
              ? `สนใจ: ${normalized.storeHelpInterests.join(", ")}`
              : null,
            normalized.notes || null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        latitude: null,
        longitude: null,
        address: null,
        source: null,
      });
    }
  }

  const p = locFields(pickup);
  const d = locFields(dropoff);
  const interestNote =
    multi && normalized.storeHelpInterests.length
      ? `สนใจ: ${normalized.storeHelpInterests.join(", ")}`
      : null;
  const tripNotes =
    [normalized.notes || null, interestNote].filter(Boolean).join("\n") || null;

  const startTime = multi
    ? normalizeClockTime(resolveDays(normalized)[0]?.startTime || normalized.startTime)
    : normalizeClockTime(normalized.startTime);

  const payload: BookingSubmitPayload = {
    businessSlug: slug,
    clientRequestId: options?.clientRequestId ?? bookingRequestId(),
    tripPackageId: normalized.tripPackageId,
    serviceType: normalized.serviceType,
    startDate: normalized.startDate,
    startTime,
    endDate,
    endTime,
    passengerCount: normalized.passengers,
    luggageCount: normalized.luggage ?? 0,
    pickupLocation: p.label!,
    pickupLat: p.latitude,
    pickupLng: p.longitude,
    pickupAddress: p.address,
    pickupPlaceId: p.placeId,
    pickupNote: p.customerNote,
    pickupSource: p.source,
    dropoffLocation: d.label,
    dropoffLat: d.latitude,
    dropoffLng: d.longitude,
    dropoffAddress: d.address,
    dropoffPlaceId: d.placeId,
    dropoffNote: d.customerNote,
    dropoffSource: d.source,
    tripNotes,
    letStorePlanTrip: normalized.letStorePlanTrip,
    preferredVehicleId: normalized.letStoreChooseVehicle
      ? null
      : normalized.preferredVehicleId,
    placeIds,
    itineraryDays,
    storeHelpInterests: normalized.storeHelpInterests,
    customerName: normalized.name.trim(),
    customerPhone: normalized.phone.trim(),
    customerEmail: normalized.email.trim() || null,
    customerType: normalized.customerType,
    companyName:
      normalized.customerType === "COMPANY"
        ? normalized.companyName.trim() || null
        : null,
    taxId:
      normalized.customerType === "COMPANY" ? normalized.taxId.trim() || null : null,
    source,
    sessionId: options?.sessionId ?? bookingSessionId(),
    referrer:
      options?.referrer !== undefined
        ? options.referrer
        : typeof document !== "undefined"
          ? document.referrer || null
          : null,
  };

  return { ok: true, payload };
}

/** Compatibility wrapper used by existing checks / wizard */
export function draftToSubmitPayload(
  slug: string,
  draft: BookingDraft,
  source: BookingSource,
): BookingSubmitPayload | { error: string } {
  const result = buildBookingSubmitPayload(slug, draft, source);
  if (!result.ok) return { error: result.error };
  return result.payload;
}

const PATH_MESSAGE: Record<string, string> = {
  businessSlug: "ข้อมูลร้านไม่ครบ",
  clientRequestId: "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง",
  serviceType: "กรุณาเลือกบริการ",
  startDate: "กรุณาเลือกวันที่เดินทาง",
  startTime: "กรุณาเลือกเวลาเดินทาง",
  endDate: "กรุณาเลือกวันสิ้นสุด",
  endTime: "กรุณาเลือกเวลาสิ้นสุด",
  passengerCount: "จำนวนผู้โดยสารไม่ถูกต้อง",
  luggageCount: "จำนวนกระเป๋าไม่ถูกต้อง",
  pickupLocation: "กรุณาเลือกจุดรับ",
  dropoffLocation: "กรุณาเลือกจุดส่ง",
  preferredVehicleId: "กรุณาเลือกรถ หรือให้ร้านเลือกรถให้",
  customerName: "กรุณากรอกชื่อ",
  customerPhone: "กรุณากรอกเบอร์โทร",
  customerEmail: "รูปแบบอีเมลไม่ถูกต้อง",
  placeIds: "จุดแวะไม่ถูกต้อง",
  sessionId: "เซสชันหมดอายุ กรุณาลองอีกครั้ง",
  source: "ข้อมูลแหล่งที่มาไม่ถูกต้อง",
};

function pathKey(path: PropertyKey[]): string {
  return path.map(String).join(".");
}

export function mapZodIssuesToFieldIssues(
  zodIssues: { path: PropertyKey[]; message: string; code?: string }[],
): BookingFieldIssue[] {
  return zodIssues.map((zIssue) => {
    const path = pathKey(zIssue.path);
    const root = String(zIssue.path[0] ?? "other");
    const message =
      PATH_MESSAGE[root] ??
      (root === "itineraryDays"
        ? "ข้อมูลแผนการเดินทางไม่ครบ"
        : "กรอกข้อมูลให้ครบก่อนส่งคำขอจอง");
    let step: BookingWizardStep = 1;
    let section: BookingFieldIssue["section"] = "other";
    if (
      [
        "customerName",
        "customerPhone",
        "customerEmail",
        "customerType",
        "companyName",
        "taxId",
      ].includes(root)
    ) {
      step = 4;
      section = "customer";
    } else if (root === "preferredVehicleId" || root === "passengerCount" || root === "luggageCount") {
      step = 3;
      section = root === "preferredVehicleId" ? "vehicle" : "trip";
    } else if (root === "serviceType") {
      step = 1;
      section = "trip";
    } else if (
      [
        "startDate",
        "startTime",
        "endDate",
        "endTime",
        "pickupLocation",
        "dropoffLocation",
        "placeIds",
        "itineraryDays",
        "letStorePlanTrip",
      ].includes(root)
    ) {
      step = 2;
      section = "trip";
    }
    return {
      path,
      code: zIssue.code ?? "invalid",
      message,
      step,
      section,
    };
  });
}

export function parseBookingSubmitPayload(raw: unknown): BookingSubmitBuildResult {
  const parsed = bookingRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = mapZodIssuesToFieldIssues(parsed.error.issues);
    return { ok: false, issues, error: summarizeIssues(issues) };
  }
  return { ok: true, payload: parsed.data as BookingSubmitPayload };
}

export function logBookingValidationFailure(issues: BookingFieldIssue[]) {
  if (process.env.NODE_ENV === "production") return;
  console.warn(
    "booking validation failed:",
    issues.map((i) => ({ path: i.path, code: i.code })),
  );
}

/** Normalize a possibly-legacy draft before validation (strips stale traps). */
export function normalizeDraftForSubmit(draft: BookingDraft): BookingDraft {
  const next = emptyBookingDraft({
    ...draft,
    version: 4,
    email: draft.email?.trim() ?? "",
    notes: draft.notes ?? "",
    placeIds: filterUuidPlaceIds(draft.placeIds),
    startTime: normalizeClockTime(draft.startTime) ?? draft.startTime,
    endTime: normalizeClockTime(draft.endTime) ?? (draft.endTime ? draft.endTime : ""),
    luggage: Number.isFinite(draft.luggage) ? draft.luggage : 0,
    preferredVehicleId: draft.letStoreChooseVehicle ? null : draft.preferredVehicleId,
  });
  if (isMultiDayService(next.serviceType) && next.startDate) {
    next.days = resolveDays(next).map((day) => ({
      ...day,
      startTime: normalizeClockTime(day.startTime) ?? day.startTime,
      endTime: normalizeClockTime(day.endTime) ?? day.endTime,
    }));
  }
  return next;
}

export function reviewSectionWarnings(draft: BookingDraft): {
  trip?: string;
  vehicle?: string;
  customer?: string;
} {
  const issues = collectBookingDraftIssues(normalizeDraftForSubmit(draft));
  const out: { trip?: string; vehicle?: string; customer?: string } = {};
  for (const item of issues) {
    if (item.section === "trip" && !out.trip) out.trip = item.message;
    if (item.section === "vehicle" && !out.vehicle) out.vehicle = item.message;
    if (item.section === "customer" && !out.customer) out.customer = item.message;
  }
  return out;
}
