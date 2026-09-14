import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string; fileId: string }> },
) {
  const { token, fileId } = await ctx.params;
  const result = await getStore().readSlipFileByToken(token, fileId);
  if (!result) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  return new NextResponse(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": result.mime,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
