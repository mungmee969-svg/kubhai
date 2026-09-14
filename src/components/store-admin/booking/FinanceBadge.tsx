import { FINANCE_BADGE, FINANCE_LABEL, type FinanceState } from "@/lib/domain/settlement";

export function FinanceBadge({
  state,
  label,
}: {
  state: FinanceState;
  label?: string;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${FINANCE_BADGE[state]}`}>
      {label ?? FINANCE_LABEL[state]}
    </span>
  );
}
