import Link from "next/link";
import { randomUUID } from "node:crypto";
import { BrandMark } from "@/components/brand/BrandMark";
import { MerchantSignupForm } from "@/components/store-admin/MerchantSignupForm";
import {
  PUBLIC_SAAS_PLANS,
  formatPlanPriceThb,
} from "@/lib/domain/saas-plans";

export const metadata = {
  title: "สมัครร้านค้า | KubHai",
};

export default async function StoreSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const requested = (await searchParams).plan;
  const selected =
    requested === "pro" || requested === "business" ? requested : "starter";

  return (
    <main className="min-h-dvh bg-paper px-4 py-8 text-navy-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="กลับหน้า KubHai">
            <BrandMark size={44} priority />
          </Link>
          <Link
            href="/store/login"
            className="inline-flex h-11 items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-navy-950/10"
          >
            มีบัญชีร้านแล้ว
          </Link>
        </header>

        <section className="mx-auto max-w-2xl py-10 text-center">
          <p className="text-sm font-semibold text-accent-deep">KubHai สำหรับธุรกิจเดินทาง</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">สมัครเปิดร้านกับขับให้</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            เลือกแพ็กเกจ สร้างบัญชีเจ้าของร้านและพื้นที่ทำงาน
            จากนั้นชำระค่าบริการผ่านรอบบิลของ KubHai
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3" aria-label="แพ็กเกจร้านค้า">
          {PUBLIC_SAAS_PLANS.map((plan) => {
            const active = selected === plan.id;
            return (
              <article
                key={plan.id}
                className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${
                  active ? "ring-accent-deep" : "ring-navy-950/8"
                }`}
              >
                <h2 className="text-lg font-semibold">{plan.nameTh}</h2>
                <p className="mt-1 text-2xl font-semibold">
                  {formatPlanPriceThb(plan.priceMonthlyThb)}
                  <span className="text-xs font-normal text-muted"> / เดือน</span>
                </p>
                <p className="mt-2 text-sm text-muted">{plan.tagline}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.highlights.filter(Boolean).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <Link
                  href={`/store/signup?plan=${plan.id}`}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-navy-800 text-sm font-semibold text-white"
                >
                  เลือก {plan.nameTh}
                </Link>
              </article>
            );
          })}
        </section>

        <MerchantSignupForm
          planId={selected}
          idempotencyKey={randomUUID()}
        />

        <section className="mx-auto mt-8 max-w-xl rounded-3xl bg-navy-800 p-6 text-center text-white">
          <p className="font-semibold">
            เลือกแพ็กเกจ {selected.toUpperCase()} แล้ว
          </p>
          <p className="mt-2 text-sm text-white/70">
            มีบัญชีร้านอยู่แล้วสามารถเข้าสู่ Store Admin ผ่านระบบเดิมได้ทันที
          </p>
          <Link
            href="/store/login"
            className="mt-4 inline-flex h-12 items-center rounded-2xl bg-accent px-5 text-sm font-semibold text-navy-950"
          >
            เข้าสู่ระบบร้าน
          </Link>
        </section>
      </div>
    </main>
  );
}
