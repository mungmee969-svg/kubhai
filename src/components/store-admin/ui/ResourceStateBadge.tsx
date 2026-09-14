import { RESOURCE_STATE_LABEL, type ResourceState } from "@/lib/domain/ops";

const CLASS: Record<ResourceState, string> = {
  FREE: "bg-success/15 text-success",
  BUSY: "bg-danger/10 text-danger",
  SOFT: "bg-accent/20 text-navy-800",
  UNAVAILABLE: "bg-line text-muted",
};

export function ResourceStateBadge({ state }: { state: ResourceState }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${CLASS[state]}`}>
      {RESOURCE_STATE_LABEL[state]}
    </span>
  );
}
