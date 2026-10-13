import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import Sidebar from "@/components/Sidebar";
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

// Apply a saved theme before first paint so there is no flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before React loads. */}
      <body className="min-h-full font-sans lg:flex" suppressHydrationWarning>
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {USE_MOCK && (
            <div className="border-b border-line bg-pay-soft px-4 py-2 text-center text-xs text-ink">
              Showing saved results: the backend is not connected, so the dashboard uses the last
              exported model output.
            </div>
          )}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
          <footer className="px-4 pb-6 text-center text-xs text-faint sm:px-8">
            Season A maize, Eastern Province · District-level data only, no farmer records
          </footer>
        </div>
      </body>
    </html>
  );
}
