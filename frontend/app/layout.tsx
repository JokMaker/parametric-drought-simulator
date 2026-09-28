import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import { USE_MOCK } from "@/lib/api";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drought Index Simulator",
  description:
    "Parametric drought-index insurance simulator for smallholder maize farmers in Eastern Rwanda.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <NavBar />
        {USE_MOCK && (
          <div className="border-b border-pay/20 bg-pay-soft px-4 py-1.5 text-center text-xs text-pay">
            Showing saved notebook results. Seasons without yield data and per-district history
            need the backend.
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
          Season A maize, Eastern Province. District-level data only; no farmer records.
        </footer>
      </body>
    </html>
  );
}
