import type { ServiceType } from "@/lib/domain/enums";

/** Consistent stroke icon set for booking Card 1 — no emoji. */
export function ServiceTypeIcon({ type }: { type: ServiceType }) {
  switch (type) {
    case "AIRPORT_TRANSFER":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M10.5 19.5 8 21.5l.7-3.4L4.5 14l3.6-.5L10.5 8l2.4 5.5 3.6.5-4.2 4.1.7 3.4-2.5-2Z" />
          <path d="M4 20h16" />
        </svg>
      );
    case "POINT_TO_POINT":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="6.5" cy="7" r="2.25" />
          <circle cx="17.5" cy="17" r="2.25" />
          <path d="M8.5 8.5 15.5 15.5" />
        </svg>
      );
    case "PRIVATE_DRIVER_DAILY":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M4 15.5h16l-1.2-4.2A2 2 0 0 0 16.9 10H7.1a2 2 0 0 0-1.9 1.3L4 15.5Z" />
          <path d="M6.5 15.5v2M17.5 15.5v2M7 10 8.2 7.4A1.5 1.5 0 0 1 9.5 6.5h5a1.5 1.5 0 0 1 1.3.9L17 10" />
          <circle cx="8" cy="15.5" r="1.1" />
          <circle cx="16" cy="15.5" r="1.1" />
        </svg>
      );
    case "MULTI_DAY_TRIP":
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
          <path d="M8 3.5v4M16 3.5v4M4.5 10.5h15" />
          <path d="M9 14.5h2.5M12.5 14.5H15M9 17.5h6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 8.5v4l2.5 1.5" />
        </svg>
      );
  }
}
