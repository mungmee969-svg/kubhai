import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { getStore } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  const account = await getStore().getCustomerAccount(session.customerAccountId);
  if (!account) redirect("/account/login");

  return (
    <div className="space-y-4 rounded-3xl bg-white p-5">
      <h1 className="text-2xl font-semibold text-navy-800">โปรไฟล์</h1>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted">ชื่อ</dt>
          <dd className="font-medium text-navy-800">{account.displayName || "-"}</dd>
        </div>
        <div>
          <dt className="text-muted">เบอร์โทร</dt>
          <dd className="font-medium text-navy-800">{account.phone || "ยังไม่ยืนยัน"}</dd>
        </div>
        <div>
          <dt className="text-muted">อีเมล</dt>
          <dd className="font-medium text-navy-800">{account.email || "-"}</dd>
        </div>
        <div>
          <dt className="text-muted">ยืนยันเบอร์</dt>
          <dd className="font-medium text-navy-800">
            {account.phoneVerifiedAt ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
