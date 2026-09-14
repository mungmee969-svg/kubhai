import { BOOKING_SOURCES, type BookingSource } from "@/lib/domain/enums";

export function sourceFromSearch(search: string | URLSearchParams): BookingSource {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const raw = (
    params.get("src") ||
    params.get("utm_source") ||
    params.get("source") ||
    ""
  )
    .trim()
    .toUpperCase();
  if ((BOOKING_SOURCES as readonly string[]).includes(raw)) {
    return raw as BookingSource;
  }
  const aliases: Record<string, BookingSource> = {
    FB: "FACEBOOK",
    IG: "FACEBOOK",
    INSTAGRAM: "FACEBOOK",
  };
  return aliases[raw] ?? "DIRECT";
}
