"use client";

import { useEffect } from "react";
import { rememberStoreContextAction } from "@/lib/actions/store-context";

export function RememberStoreContext({ slug }: { slug: string }) {
  useEffect(() => {
    void rememberStoreContextAction(slug);
  }, [slug]);
  return null;
}
