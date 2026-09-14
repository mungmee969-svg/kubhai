import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { kubhaiBrand } from "@/lib/brand/tokens";
import "./globals.css";

const thai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "KubHai ขับให้",
    template: "%s · KubHai",
  },
  description: "ระบบรับจองรถพร้อมคนขับสำหรับธุรกิจรถเช่าและท่องเที่ยว",
  icons: {
    icon: kubhaiBrand.logoSrc,
    apple: kubhaiBrand.logoSrc,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kh_customer_theme')||'system';var l=localStorage.getItem('kh_customer_locale');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.customerTheme=d?'dark':'light';r.classList.toggle('customer-dark',d);if(l==='th'||l==='en'||l==='zh'){r.lang=l==='zh'?'zh-Hans':l;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
