import { NextResponse } from "next/server";
import { requireStoreContext } from "@/lib/auth/tenant";
import { TenantIsolationError } from "@/lib/data";
import { assertSafeStorageId } from "@/lib/data/private-slips";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  try {
    assertSafeStorageId(fileId);
    const storeCtx = await requireStoreContext();
    if (!storeCtx.businessId) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }
    const result = await storeCtx.store.readSlipFile(storeCtx.actor, fileId);
    if (result.file.businessId !== storeCtx.businessId) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }
    return new NextResponse(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": result.mime,
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "ไม่พบสลิป" }, { status: 404 });
  }
}
