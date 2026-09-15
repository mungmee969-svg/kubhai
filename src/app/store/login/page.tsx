import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { LOCAL_DEV_PASSWORD } from "@/lib/data/seed";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "เข้าสู่ระบบจัดการ | KubHai",
};

export default function StoreLoginPage() {
  return (
    <div className="min-h-dvh bg-navy-800 text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={88} priority />
          <h1 className="mt-5 text-2xl font-semibold">เข้าสู่ระบบจัดการ</h1>
          <p className="mt-2 text-sm text-white/70">
            ใช้สำหรับ Platform Owner เจ้าของร้าน ผู้จัดการ และพนักงาน
            ระบบจะพาไปยังหน้าจัดการตามสิทธิ์ของบัญชี
          </p>
        </div>
        <LoginForm />
        <div className="mt-8 rounded-2xl bg-white/5 p-4 text-xs leading-6 text-white/70">
          <p className="font-medium text-white">บัญชีทดสอบ local-dev</p>
          <p>owner@pondcarrent.local</p>
          <p>owner@demo002.local</p>
          <p>รหัส: {LOCAL_DEV_PASSWORD}</p>
        </div>
        <p className="mt-6 text-center text-xs text-white/50">
          <Link href="/" className="underline-offset-2 hover:underline">
            ← กลับหน้า KubHai
          </Link>
        </p>
      </div>
    </div>
  );
}
