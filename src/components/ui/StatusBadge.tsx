import type { BookingStatus } from "@/lib/domain/enums";
import { customerStatusPresentation, statusPresentation } from "@/lib/domain/status-ui";

export function StatusBadge({
  status,
  audience = "store",
}: {
  status: BookingStatus;
  audience?: "store" | "customer";
}) {
  const presentation =
    audience === "customer" ? customerStatusPresentation(status) : statusPresentation(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${presentation.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${presentation.dotClass}`} />
      {presentation.label}
    </span>
  );
}
