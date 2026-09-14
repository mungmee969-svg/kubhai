import Link from "next/link";

export function EmptyState({
  title,
  hint,
  actionHref,
  actionLabel,
}: {
  title: string;
  hint?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center">
      <p className="font-medium text-navy-800">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-navy-950"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
