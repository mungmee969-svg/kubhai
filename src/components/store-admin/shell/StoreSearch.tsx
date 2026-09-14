"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchOpsAction } from "@/lib/actions/ops";

export function StoreSearch({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchOpsAction>>["data"] | null>(
    null,
  );
  const ready = query.trim().length >= 2;

  useEffect(() => {
    if (!open || !ready) return;
    const timer = window.setTimeout(() => {
      setPending(true);
      void searchOpsAction(businessId, query).then((result) => {
        setResults(result.data);
        setPending(false);
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [businessId, open, query, ready]);

  return (
    <div className="relative min-w-0 flex-1 md:max-w-md">
      <input
        className="admin-input h-10"
        placeholder="ค้นหา Booking / ลูกค้า / ทะเบียน / คนขับ"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (e.target.value.trim().length < 2) setResults(null);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && ready ? (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-line bg-white p-3 shadow-lg">
          {pending ? <p className="text-sm text-muted">กำลังค้นหา...</p> : null}
          {!pending && results ? (
            <div className="space-y-3 text-sm">
              {results.bookings.map((item) => (
                <Link key={item.id} href={`/store/bookings/${item.id}`} className="block">
                  {item.bookingCode} · {item.customerNameSnapshot}
                </Link>
              ))}
              {results.customers.map((item) => (
                <Link key={item.id} href={`/store/customers/${item.id}`} className="block">
                  ลูกค้า {item.name} · {item.phone}
                </Link>
              ))}
              {results.vehicles.map((item) => (
                <Link key={item.id} href={`/store/vehicles/${item.id}`} className="block">
                  รถ {item.brand} {item.model}
                </Link>
              ))}
              {results.drivers.map((item) => (
                <Link key={item.id} href={`/store/drivers/${item.id}`} className="block">
                  คนขับ {item.name}
                </Link>
              ))}
              {!results.bookings.length &&
              !results.customers.length &&
              !results.vehicles.length &&
              !results.drivers.length ? (
                <p className="text-muted">ไม่พบรายการ</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
