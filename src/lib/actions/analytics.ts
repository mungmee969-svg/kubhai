"use server";

import { getStore } from "@/lib/data";
import type { AnalyticEventName, BookingSource } from "@/lib/domain/enums";

export async function trackPublicEvent(input: {
  businessId: string;
  sessionId: string;
  eventName: AnalyticEventName;
  eventData?: Record<string, unknown>;
  source?: BookingSource | null;
  referrer?: string | null;
  bookingId?: string | null;
}) {
  if (!input.sessionId || !input.businessId) return;
  await getStore().trackEvent({
    businessId: input.businessId,
    sessionId: input.sessionId,
    customerId: null,
    bookingId: input.bookingId ?? null,
    eventName: input.eventName,
    eventData: input.eventData ?? {},
    source: input.source ?? null,
    referrer: input.referrer ?? null,
  });
}
