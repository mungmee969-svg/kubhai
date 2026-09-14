import type { BookingStatus } from "@/lib/domain/enums";
import { statusPresentation, WORKFLOW_STEPS } from "@/lib/domain/status-ui";

export function WorkflowTimeline({
  status,
  timestamps,
}: {
  status: BookingStatus;
  timestamps?: Partial<Record<BookingStatus, string>>;
}) {
  const currentIndex = WORKFLOW_STEPS.indexOf(status as (typeof WORKFLOW_STEPS)[number]);
  const terminal = status === "CANCELLED" || status === "REJECTED";

  return (
    <ol className="space-y-2">
      {terminal ? (
        <li className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {statusPresentation(status).label}
          {timestamps?.[status] ? (
            <span className="mt-1 block text-xs font-normal text-muted">
              {timestamps[status]?.slice(0, 16).replace("T", " ")}
            </span>
          ) : null}
        </li>
      ) : null}
      {WORKFLOW_STEPS.map((step, index) => {
        const current = step === status;
        const done = currentIndex >= 0 && index < currentIndex;
        const presentation = statusPresentation(step);
        return (
          <li key={step} className="flex gap-3 text-sm">
            <span
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                current ? presentation.dotClass : done ? "bg-success" : "bg-line"
              }`}
            />
            <div className={current ? "font-semibold text-navy-800" : done ? "text-navy-800" : "text-muted"}>
              <p>{presentation.shortLabel}</p>
              {timestamps?.[step] ? (
                <p className="text-xs font-normal text-muted">
                  {timestamps[step]?.slice(0, 16).replace("T", " ")}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
