import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";

export function DiscoveryShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#f6f3ee] text-navy-950">
      <div className="mx-auto max-w-lg px-5 py-8">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <BrandMark size={36} />
          <span className="font-semibold text-navy-900">
            KubHai <span className="font-medium text-muted">ขับให้</span>
          </span>
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-navy-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        {children}
        <p className="mt-10 text-center text-xs text-muted">
          <Link href="/" className="hover:text-accent-deep">
            ← กลับหน้าแรก KubHai
          </Link>
        </p>
      </div>
    </div>
  );
}
