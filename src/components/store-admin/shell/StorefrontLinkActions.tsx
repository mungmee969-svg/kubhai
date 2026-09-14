"use client";

import { useEffect, useState } from "react";
import {
  storefrontAbsoluteUrl,
  storefrontDisplayUrl,
  storefrontPath,
} from "@/lib/domain/storefront-url";

type Props = {
  slug: string;
  /** Compact dashboard bar vs settings block */
  variant?: "bar" | "settings";
};

export function StorefrontLinkActions({ slug, variant = "bar" }: Props) {
  const path = storefrontPath(slug);
  const [display, setDisplay] = useState(() => storefrontDisplayUrl(slug));
  const [absolute, setAbsolute] = useState(path);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const origin = window.location.origin;
      setAbsolute(storefrontAbsoluteUrl(slug, origin));
      setDisplay(storefrontDisplayUrl(slug, window.location.host));
      setCanShare(typeof navigator.share === "function");
    });
    return () => window.cancelAnimationFrame(id);
  }, [slug]);

  async function copyLink() {
    setError(null);
    const value = absolute.startsWith("http") ? absolute : `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("คัดลอกไม่สำเร็จ — คัดลอกจากช่อง URL เอง");
    }
  }

  async function shareLink() {
    setError(null);
    const url = absolute.startsWith("http") ? absolute : `${window.location.origin}${path}`;
    try {
      await navigator.share({
        title: "หน้าร้านออนไลน์",
        text: "จองรถกับร้าน",
        url,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      await copyLink();
    }
  }

  const copyLabel = variant === "settings" ? (copied ? "✓ คัดลอกแล้ว" : "คัดลอก") : copied ? "✓ คัดลอกแล้ว" : "คัดลอกลิงก์";
  const openLabel = variant === "settings" ? "เปิดหน้าร้าน" : "เปิดหน้าร้าน ↗";

  const openBtn = (
    <a
      href={path}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 items-center justify-center rounded-xl bg-navy-800 px-4 text-sm font-semibold text-white"
    >
      {openLabel}
    </a>
  );

  const copyBtn = (
    <button
      type="button"
      onClick={() => void copyLink()}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy-800"
    >
      {copyLabel}
    </button>
  );

  const shareBtn = canShare ? (
    <button
      type="button"
      onClick={() => void shareLink()}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy-800 md:hidden"
    >
      แชร์
    </button>
  ) : null;

  if (variant === "settings") {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-paper p-4">
        <div>
          <p className="text-sm font-semibold text-navy-800">ลิงก์หน้าร้าน</p>
          <p className="mt-1 text-xs text-muted">ส่งลิงก์นี้ให้ลูกค้าเพื่อจองรถกับร้าน</p>
        </div>
        <input
          className="admin-input bg-white"
          readOnly
          value={display}
          aria-label="ลิงก์หน้าร้าน"
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {copyBtn}
          {openBtn}
          {shareBtn}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-800">🌐 หน้าร้านออนไลน์</p>
          <p className="mt-0.5 text-xs text-muted">ส่งลิงก์นี้ให้ลูกค้าเพื่อจองรถกับร้าน</p>
          <p className="mt-2 truncate font-mono text-sm text-navy-800" title={display}>
            {display}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:shrink-0">
          {copyBtn}
          {openBtn}
          {shareBtn}
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
