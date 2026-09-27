import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { StorefrontShell } from "@/components/StorefrontShell";
import { Toast } from "@/components/Toast";
import { ScrollToTop } from "@/components/ScrollToTop";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NovaTech | Thiết Bị Công Nghệ & Smart Devices B2C",
  description:
    "Hệ thống bán lẻ trực tiếp thiết bị công nghệ thông minh cao cấp: Tai nghe ANC Hi-Res, Đồng hồ Titanium, Bàn phím cơ Custom và Phụ kiện Desk Setup.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.className} suppressHydrationWarning>
      <body
        className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white"
        suppressHydrationWarning
      >
        <AuthProvider>
          <CartProvider>
            <StorefrontShell>{children}</StorefrontShell>
            <Toast />
            <ScrollToTop />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
