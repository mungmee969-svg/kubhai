"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setDriverActiveAction, setPlaceActiveAction, setVehicleActiveAction } from "@/lib/actions/ops";

export function ActiveToggle({
  kind,
  id,
  active,
}: {
  kind: "vehicle" | "driver" | "place";
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    if (kind === "vehicle") await setVehicleActiveAction(id, !active);
    if (kind === "driver") await setDriverActiveAction(id, !active);
    if (kind === "place") await setPlaceActiveAction(id, !active);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void toggle()}
      className="text-sm text-navy-800 disabled:opacity-60"
    >
      {active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
    </button>
  );
}
