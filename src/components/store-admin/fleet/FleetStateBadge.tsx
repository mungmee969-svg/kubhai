import { FLEET_VISUAL, type FleetVisualState } from "@/lib/domain/fleet";

export function FleetStateBadge({
  state,
  label,
}: {
  state: FleetVisualState;
  label?: string;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${FLEET_VISUAL[state].badgeClass}`}>
      {label ?? FLEET_VISUAL[state].label}
    </span>
  );
}
