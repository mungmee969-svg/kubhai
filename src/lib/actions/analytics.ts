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

  // Public analytics is best-effort. A storefront page view must never fail just
  // because the current persistence adapter is read-only (for example Vercel's
  // /var/task filesystem). Durable analytics will move with the production DB.
  try {
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
  } catch (error) {
    if (process.env.NODE_ENV !== "production") throw error;
    console.error("[analytics] public event persistence unavailable", {
      eventName: input.eventName,
      businessId: input.businessId,
    });
  }
}